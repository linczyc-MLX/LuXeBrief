import type { Express, Request, Response as ExpressResponse, NextFunction } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { categoryLabels, type Question, type Session, type Response as DBResponse, type LivingResponse, insertQuestionSchema, livingSteps, type TasteSelection, type TasteProfile, tasteCategories, TASTE_SELECTION_WEIGHTS, type TasteProfileResult } from "@shared/schema";
import { tasteQuads, getTasteQuadCount } from "@shared/tasteQuads";
import OpenAI, { toFile } from "openai";
import PDFDocument from "pdfkit";
import { Buffer, File } from "node:buffer";
import { CloudStorageService } from "./cloudStorage";
import { sendLuXeBriefInvitation, sendTasteExplorationInvitation, verifySmtpConnection } from "./email";

// Generate secure access token for session URLs
function generateAccessToken(): string {
  return randomUUID();
}

// Polyfill File for Node.js < 20 (required by OpenAI SDK for file uploads)
if (typeof globalThis.File === "undefined") {
  globalThis.File = File as unknown as typeof globalThis.File;
}

// Simple admin token authentication middleware
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "luxury-admin-2024";

function adminAuth(req: Request, res: ExpressResponse, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Increase body limit for audio
  app.use((req, res, next) => {
    if (req.path === "/api/transcribe") {
      // Already handled by express.json with limit
    }
    next();
  });

  // ===== QUESTIONS =====
  
  // Get active questions (for briefing)
  app.get("/api/questions", async (req: Request, res: ExpressResponse) => {
    try {
      const activeQuestions = await storage.getActiveQuestions();
      res.json(activeQuestions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  // ===== SESSIONS =====
  
  // Create new session
  app.post("/api/sessions", async (req: Request, res: ExpressResponse) => {
    try {
      const { clientName, projectName } = req.body;
      if (!clientName || typeof clientName !== "string") {
        return res.status(400).json({ error: "Client name is required" });
      }

      // Create session first to get the ID
      const session = await storage.createSession({
        clientName,
        projectName: projectName || null,
        status: "in_progress",
        currentQuestionIndex: 0
      });
      
      // Get the cloud storage path for this session
      const folderPath = CloudStorageService.getSessionPath(clientName, session.id);
      
      // Update session with folder path
      const updatedSession = await storage.updateSession(session.id, { folderPath });
      
      res.status(201).json(updatedSession || session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({ error: "Failed to create session" });
    }
  });

  // Create session from N4S (with admin auth)
  // Called by N4S KYC module when "Send LuXeBrief" button is clicked
  app.post("/api/sessions/from-n4s", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const {
        n4sProjectId,
        principalType,
        clientName,
        clientEmail,
        projectName,
        subdomain,
        sessionType // 'lifestyle' (default, audio-based) or 'living' (form-based)
      } = req.body;

      // Validate required fields
      if (!clientName || typeof clientName !== "string") {
        return res.status(400).json({ error: "clientName is required" });
      }
      if (!clientEmail || typeof clientEmail !== "string") {
        return res.status(400).json({ error: "clientEmail is required" });
      }
      if (!principalType || !["principal", "secondary"].includes(principalType)) {
        return res.status(400).json({ error: "principalType must be 'principal' or 'secondary'" });
      }

      // Generate access token for secure session access
      const accessToken = generateAccessToken();

      // Validate sessionType if provided
      const validSessionType = sessionType === 'living' ? 'living' : sessionType === 'taste' ? 'taste' : 'lifestyle';

      // Create session with N4S integration fields
      const session = await storage.createSession({
        clientName,
        projectName: projectName || null,
        sessionType: validSessionType,
        status: "in_progress",
        currentQuestionIndex: 0,
        accessToken,
        n4sProjectId: n4sProjectId || null,
        n4sPrincipalType: principalType,
        clientEmail,
        subdomain: subdomain || null,
        invitationSentAt: new Date(),
      });

      // Get the cloud storage path for this session
      const folderPath = CloudStorageService.getSessionPath(clientName, session.id);

      // Update session with folder path
      const updatedSession = await storage.updateSession(session.id, { folderPath });

      // Build the invitation URL - use appropriate route based on session type
      const baseUrl = subdomain
        ? `https://${subdomain}.luxebrief.not-4.sale`
        : `https://luxebrief.not-4.sale`;
      let sessionRoute: string;
      let invitationUrl: string;
      if (validSessionType === 'taste') {
        sessionRoute = 'taste';
        invitationUrl = `${baseUrl}/${sessionRoute}/${accessToken}`; // Taste uses token directly in URL
      } else {
        sessionRoute = validSessionType === 'living' ? 'living' : 'briefing';
        invitationUrl = `${baseUrl}/${sessionRoute}/${session.id}?token=${accessToken}`;
      }

      console.log(`[N4S] Created ${validSessionType} session ${session.id} for ${clientName} (${principalType})`);
      console.log(`[N4S] Invitation URL: ${invitationUrl}`);

      // Send email invitation
      let emailSent = false;
      try {
        if (validSessionType === 'taste') {
          // Use dedicated Taste Exploration email template
          emailSent = await sendTasteExplorationInvitation({
            clientName,
            clientEmail,
            projectName: projectName || "Luxury Residence Project",
            invitationUrl,
            principalType: principalType as "principal" | "secondary",
          });
        } else {
          emailSent = await sendLuXeBriefInvitation({
            clientName,
            clientEmail,
            projectName: projectName || "Luxury Residence Project",
            invitationUrl,
            principalType: principalType as "principal" | "secondary",
            sessionType: validSessionType,
          });
        }
      } catch (emailError) {
        console.error("[N4S] Email sending failed:", emailError);
      }

      res.status(201).json({
        sessionId: session.id,
        accessToken,
        invitationUrl,
        subdomain: subdomain || null,
        status: "created",
        emailSent,
        message: emailSent
          ? `Session created and invitation sent to ${clientEmail}.`
          : `Session created for ${clientName}. Email could not be sent - use the invitation URL manually.`
      });
    } catch (error) {
      console.error("Error creating N4S session:", error);
      res.status(500).json({ error: "Failed to create session from N4S" });
    }
  });

  // Get session with responses
  app.get("/api/sessions/:id", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Include both Lifestyle responses (audio) and Living responses (form-based)
      const responses = await storage.getResponsesBySession(id);
      const livingResponses = await storage.getLivingResponsesBySession(id);
      res.json({ ...session, responses, livingResponses });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  // Get sessions by email (for N4S status lookup when session ID mismatch)
  // Returns the most recent completed session first, or most recent overall if none completed
  app.get("/api/sessions/by-email/:email", async (req: Request, res: ExpressResponse) => {
    try {
      const email = decodeURIComponent(req.params.email as string);
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      // Optional sessionType filter (living or lifestyle)
      const sessionTypeFilter = req.query.sessionType as string | undefined;

      let allSessions = await storage.getSessionsByEmail(email);

      // Filter by sessionType if specified
      if (sessionTypeFilter && ['living', 'lifestyle'].includes(sessionTypeFilter)) {
        allSessions = allSessions.filter(s => s.sessionType === sessionTypeFilter);
      }

      if (allSessions.length === 0) {
        return res.status(404).json({ error: "No sessions found for this email" });
      }

      // Find the most recent completed session, or fall back to most recent overall
      const completedSession = allSessions.find(s => s.status === 'completed');
      const bestSession = completedSession || allSessions[0];

      // Return the best session with basic info
      res.json({
        sessionId: bestSession.id,
        status: bestSession.status,
        sessionType: bestSession.sessionType,
        clientName: bestSession.clientName,
        completedAt: bestSession.completedAt,
        createdAt: bestSession.createdAt,
        allSessions: allSessions.map(s => ({
          sessionId: s.id,
          sessionType: s.sessionType,
          status: s.status,
          createdAt: s.createdAt,
          completedAt: s.completedAt
        }))
      });
    } catch (error) {
      console.error("Error fetching sessions by email:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get session with report (for report page)
  app.get("/api/sessions/:id/report", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const responses = await storage.getResponsesBySession(id);
      const livingResponses = await storage.getLivingResponsesBySession(id);
      const report = await storage.getReport(id);

      res.json({ ...session, responses, livingResponses, report });
    } catch (error) {
      console.error("Error fetching session report:", error);
      res.status(500).json({ error: "Failed to fetch session report" });
    }
  });

  // Update session (current question index)
  app.patch("/api/sessions/:id", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const { currentQuestionIndex } = req.body;
      
      const session = await storage.updateSession(id, { 
        currentQuestionIndex 
      });
      
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // Save response for a question (with file persistence)
  app.post("/api/sessions/:id/responses", async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id as string);
      const { questionId, transcription, isCompleted, audio, questionTitle } = req.body;
      
      // Get session for client name
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Build update data - only include file paths if files were saved
      const updateData: any = {
        transcription,
        isCompleted,
      };
      
      // Save audio file if provided
      if (audio) {
        const audioBuffer = Buffer.from(audio, "base64");
        updateData.audioFilePath = await CloudStorageService.saveAudio(
          session.clientName, 
          sessionId, 
          questionId, 
          audioBuffer, 
          "webm"
        );
      }
      
      // Save transcript file if transcription provided
      if (transcription) {
        updateData.transcriptFilePath = await CloudStorageService.saveTranscript(
          session.clientName,
          sessionId,
          questionId,
          transcription,
          questionTitle
        );
      }
      
      const response = await storage.createOrUpdateResponse(sessionId, questionId, updateData);

      res.status(201).json(response);
    } catch (error) {
      console.error("Error saving response:", error);
      res.status(500).json({ error: "Failed to save response" });
    }
  });

  // Save Living questionnaire step response
  app.post("/api/sessions/:id/living-response", async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id as string);
      const { stepId, data, isCompleted } = req.body;

      // Validate required fields
      if (!stepId || typeof stepId !== "string") {
        return res.status(400).json({ error: "stepId is required" });
      }
      if (!data || typeof data !== "string") {
        return res.status(400).json({ error: "data must be a JSON string" });
      }

      // Get session to verify it exists
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Save or update the living response
      const livingResponse = await storage.createOrUpdateLivingResponse(sessionId, stepId, {
        data,
        isCompleted: isCompleted ?? true,
      });

      res.status(201).json(livingResponse);
    } catch (error) {
      console.error("Error saving living response:", error);
      res.status(500).json({ error: "Failed to save living response" });
    }
  });

  // Get Living responses for a session
  app.get("/api/sessions/:id/living-responses", async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id as string);
      const responses = await storage.getLivingResponsesBySession(sessionId);
      res.json(responses);
    } catch (error) {
      console.error("Error fetching living responses:", error);
      res.status(500).json({ error: "Failed to fetch living responses" });
    }
  });

  // Complete Living session (form-based - no AI processing needed)
  app.post("/api/sessions/:id/complete-living", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get all living responses
      const livingResponses = await storage.getLivingResponsesBySession(id);

      // Save Living report data as JSON
      const reportData = {
        clientName: session.clientName,
        sessionId: id,
        sessionType: 'living',
        generatedAt: new Date().toISOString(),
        responses: livingResponses.map(r => ({
          stepId: r.stepId,
          data: JSON.parse(r.data),
          isCompleted: r.isCompleted,
        })),
      };

      const { jsonPath } = await CloudStorageService.saveReport(session.clientName, id, reportData);

      // Generate and save PDF
      let pdfPath: string | null = null;
      try {
        const pdfBuffer = await generateLivingPdfBuffer(session, livingResponses);
        pdfPath = await CloudStorageService.savePdf(session.clientName, id, pdfBuffer);
        console.log("Living PDF saved to cloud storage:", pdfPath);
      } catch (pdfError) {
        console.error("Error saving Living PDF:", pdfError);
      }

      // Update session status
      await storage.updateSession(id, {
        status: "completed",
        completedAt: new Date(),
      });

      // Create report record for Living session (so Report page works)
      await storage.createReport({
        sessionId: id,
        summary: `Living Space Program completed for ${session.clientName}`,
        designPreferences: JSON.stringify({
          type: 'living',
          data: livingResponses.map(r => ({ stepId: r.stepId, data: JSON.parse(r.data) }))
        }),
        functionalNeeds: null,
        lifestyleElements: null,
        additionalNotes: null,
        jsonFilePath: jsonPath,
        pdfFilePath: pdfPath,
      });

      res.json({ success: true, pdfPath, jsonPath });
    } catch (error) {
      console.error("Error completing Living session:", error);
      res.status(500).json({ error: "Failed to complete Living session" });
    }
  });

  // Complete session and generate report
  app.post("/api/sessions/:id/complete", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const responses = await storage.getResponsesBySession(id);
      const allQuestions = await storage.getQuestions();
      
      // Build context from all responses
      const responseContext = responses
        .filter(r => r.transcription)
        .map(r => {
          const question = allQuestions.find((q: Question) => q.id === r.questionId);
          return `Question: ${question?.question || "Unknown"}\nResponse: ${r.transcription}`;
        })
        .join("\n\n");
      
      // Generate AI summary
      let fullSummary = "Unable to generate summary.";
      try {
        console.log("Generating AI summary for client:", session.clientName);
        console.log("Response context length:", responseContext.length);
        
        const summaryResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert luxury residence design consultant writing a professional design brief. Write in flowing, professional prose paragraphs. NEVER use bullet points, numbered lists, or markdown formatting like **bold** or *italic*. Write as if this will be printed in a luxury design document.`
            },
            {
              role: "user",
              content: `Analyze these client briefing responses for an ultra-luxury private residence and write in flowing prose paragraphs (NO bullet points, NO numbered lists, NO markdown).

Write these sections with clear headings:

EXECUTIVE SUMMARY
Write 2-3 substantial paragraphs capturing the client's overall vision, aspirations, and what they want to feel in their new home.

DESIGN PREFERENCES
Write 1-2 paragraphs about their aesthetic preferences, materials, colors, and architectural style.

FUNCTIONAL REQUIREMENTS
Write 1-2 paragraphs about practical needs: space flow, security, technology, and how the home should function.

LIFESTYLE ELEMENTS
Write 1-2 paragraphs about daily routines, entertaining style, and how they envision living in the space.

ADDITIONAL NOTES
Write 1 paragraph with other observations or recommendations.

Client: ${session.clientName}
Project: ${session.projectName || "Luxury Residence"}

Responses:
${responseContext}`
            }
          ],
          max_completion_tokens: 2048,
        });
        
        fullSummary = summaryResponse.choices[0]?.message?.content || "Unable to generate summary.";
        console.log("AI summary generated successfully, length:", fullSummary.length);
      } catch (aiError) {
        console.error("AI summary generation failed:", aiError);
        fullSummary = "Unable to generate summary due to an error. Please try again later.";
      }
      
      // Parse sections from the AI response
      const sections = parseSummarySections(fullSummary);
      
      // Save report JSON to file storage
      const reportData = {
        clientName: session.clientName,
        sessionId: id,
        generatedAt: new Date().toISOString(),
        summary: sections.summary,
        designPreferences: sections.designPreferences,
        functionalNeeds: sections.functionalNeeds,
        lifestyleElements: sections.lifestyleElements,
        additionalNotes: sections.additionalNotes,
        responses: responses.map(r => {
          const question = allQuestions.find((q: Question) => q.id === r.questionId);
          return {
            questionId: r.questionId,
            questionTitle: question?.title || "Unknown",
            question: question?.question || "Unknown",
            transcription: r.transcription,
          };
        }),
      };
      
      const { jsonPath } = await CloudStorageService.saveReport(
        session.clientName,
        id,
        reportData
      );
      
      // Generate and save PDF to cloud storage
      let pdfPath: string | null = null;
      try {
        const pdfBuffer = await generatePdfBuffer(session, responses, sections, allQuestions);
        pdfPath = await CloudStorageService.savePdf(session.clientName, id, pdfBuffer);
        console.log("PDF saved to cloud storage:", pdfPath);
      } catch (pdfError) {
        console.error("Error saving PDF to cloud storage:", pdfError);
        // Continue without PDF - it can still be generated on-demand
      }
      
      // Create report in database
      const report = await storage.createReport({
        sessionId: id,
        summary: sections.summary,
        designPreferences: sections.designPreferences,
        functionalNeeds: sections.functionalNeeds,
        lifestyleElements: sections.lifestyleElements,
        additionalNotes: sections.additionalNotes,
        jsonFilePath: jsonPath,
        pdfFilePath: pdfPath,
      });
      
      // Update session status
      await storage.updateSession(id, {
        status: "completed",
        completedAt: new Date(),
      });
      
      res.json({ success: true, reportId: report.id });
    } catch (error) {
      console.error("Error completing session:", error);
      res.status(500).json({ error: "Failed to complete session" });
    }
  });

  // ===== FILE DOWNLOADS =====
  
  // Download session files (audio, transcripts, reports)
  // Requires session access token for security
  app.get("/api/sessions/:id/files/:fileType/:fileName", async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id as string);
      
      // Validate session ID is a positive integer to prevent enumeration
      if (isNaN(sessionId) || sessionId <= 0) {
        return res.status(400).json({ error: "Invalid session ID" });
      }
      
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Verify access token (from query param or Authorization header)
      const token = req.query.token as string || req.headers.authorization?.replace("Bearer ", "");
      if (!token || token !== session.accessToken) {
        return res.status(401).json({ error: "Invalid or missing access token" });
      }
      
      // Get the file type and name from the request
      const { fileType, fileName } = req.params;
      if (!fileType || !fileName) {
        return res.status(400).json({ error: "File type and name required" });
      }
      
      // Validate file type
      const fileTypeStr = Array.isArray(fileType) ? fileType[0] : fileType;
      if (!["audio", "transcripts", "reports"].includes(fileTypeStr)) {
        return res.status(400).json({ error: "Invalid file type" });
      }
      
      // Construct the full file path using local storage
      const sessionPath = CloudStorageService.getSessionPath(session.clientName, sessionId);
      const fullPath = `${sessionPath}/${fileType}/${fileName}`;

      const fileBuffer = await CloudStorageService.readFile(fullPath);
      if (!fileBuffer) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Set content type based on file extension
      const fileNameStr = Array.isArray(fileName) ? fileName[0] : fileName;
      let contentType = "application/octet-stream";
      if (fileNameStr.endsWith(".webm")) contentType = "audio/webm";
      else if (fileNameStr.endsWith(".wav")) contentType = "audio/wav";
      else if (fileNameStr.endsWith(".txt")) contentType = "text/plain; charset=utf-8";
      else if (fileNameStr.endsWith(".json")) contentType = "application/json";
      else if (fileNameStr.endsWith(".pdf")) contentType = "application/pdf";
      
      res.setHeader("Content-Type", contentType);
      res.send(fileBuffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // List session files (requires access token)
  app.get("/api/sessions/:id/files", async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id as string);
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Verify access token
      const token = req.query.token as string || req.headers.authorization?.replace("Bearer ", "");
      if (!token || token !== session.accessToken) {
        return res.status(401).json({ error: "Invalid or missing access token" });
      }
      
      const files = await CloudStorageService.listSessionFiles(session.clientName, sessionId);
      res.json({ files });
    } catch (error) {
      console.error("Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // ===== TRANSCRIPTION =====
  
  app.post("/api/transcribe", async (req: Request, res: ExpressResponse) => {
    try {
      const { audio } = req.body;
      if (!audio) {
        return res.status(400).json({ error: "Audio data is required" });
      }
      
      // OpenAI accepts WebM/Opus directly - no conversion needed
      const webmBuffer = Buffer.from(audio, "base64");
      
      // Transcribe using OpenAI (accepts webm format)
      const file = await toFile(webmBuffer, "audio.webm");
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "gpt-4o-mini-transcribe",
      });
      
      res.json({ transcription: transcription.text });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  // ===== ADMIN QUESTIONS =====
  
  // Verify admin token
  app.post("/api/admin/verify", (req: Request, res: ExpressResponse) => {
    const { token } = req.body;
    if (token === ADMIN_TOKEN) {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false, error: "Invalid token" });
    }
  });
  
  // Get all questions (admin - includes inactive)
  app.get("/api/admin/questions", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const allQuestions = await storage.getQuestions();
      res.json(allQuestions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });
  
  // Create new question
  app.post("/api/admin/questions", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const parsed = insertQuestionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid question data", details: parsed.error.errors });
      }
      
      // Additional validation for required fields
      if (!parsed.data.title?.trim() || !parsed.data.question?.trim()) {
        return res.status(400).json({ error: "Title and question are required and cannot be empty" });
      }
      
      const question = await storage.createQuestion({
        ...parsed.data,
        title: parsed.data.title.trim(),
        question: parsed.data.question.trim(),
        helpText: parsed.data.helpText?.trim() || null,
      });
      res.status(201).json(question);
    } catch (error) {
      console.error("Error creating question:", error);
      res.status(500).json({ error: "Failed to create question" });
    }
  });
  
  // Update question
  app.patch("/api/admin/questions/:id", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const updates = { ...req.body };
      
      // Validate title and question if provided
      if (updates.title !== undefined && !updates.title?.trim()) {
        return res.status(400).json({ error: "Title cannot be empty" });
      }
      if (updates.question !== undefined && !updates.question?.trim()) {
        return res.status(400).json({ error: "Question cannot be empty" });
      }
      
      // Trim string fields
      if (updates.title) updates.title = updates.title.trim();
      if (updates.question) updates.question = updates.question.trim();
      if (updates.helpText !== undefined) updates.helpText = updates.helpText?.trim() || null;
      
      const question = await storage.updateQuestion(id, updates);
      
      if (!question) {
        return res.status(404).json({ error: "Question not found" });
      }
      
      res.json(question);
    } catch (error) {
      console.error("Error updating question:", error);
      res.status(500).json({ error: "Failed to update question" });
    }
  });
  
  // Delete question
  app.delete("/api/admin/questions/:id", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const deleted = await storage.deleteQuestion(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Question not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ error: "Failed to delete question" });
    }
  });
  
  // Reorder questions
  app.post("/api/admin/questions/reorder", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const { orderedIds } = req.body;
      
      // Validate orderedIds is an array
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }
      
      // Validate all IDs are numbers
      if (!orderedIds.every(id => typeof id === 'number' && !isNaN(id))) {
        return res.status(400).json({ error: "All IDs must be valid numbers" });
      }
      
      // Get all current questions
      const allQuestions = await storage.getQuestions();
      const existingIds = new Set(allQuestions.map(q => q.id));
      
      // Validate all provided IDs exist
      const providedIds = new Set(orderedIds);
      for (const id of orderedIds) {
        if (!existingIds.has(id)) {
          return res.status(400).json({ error: `Question with ID ${id} does not exist` });
        }
      }
      
      // Check for duplicates
      if (providedIds.size !== orderedIds.length) {
        return res.status(400).json({ error: "Duplicate IDs are not allowed" });
      }
      
      // Verify all question IDs are included
      if (providedIds.size !== existingIds.size) {
        return res.status(400).json({ error: "All question IDs must be included in the reorder request" });
      }
      
      await storage.reorderQuestions(orderedIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering questions:", error);
      res.status(500).json({ error: "Failed to reorder questions" });
    }
  });

  // ===== SITE CONTENT =====
  
  // Get all site content (public)
  app.get("/api/content", async (req: Request, res: ExpressResponse) => {
    try {
      const allContent = await storage.getAllContent();
      // Return as a key-value map for easy frontend use
      const contentMap: Record<string, string> = {};
      for (const item of allContent) {
        contentMap[item.key] = item.value;
      }
      res.json(contentMap);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });
  
  // Get all content with metadata (admin)
  app.get("/api/admin/content", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const allContent = await storage.getAllContent();
      res.json(allContent);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });
  
  // Update content item (admin)
  app.patch("/api/admin/content/:key", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const key = req.params.key as string;
      const { value } = req.body;
      
      if (typeof value !== "string") {
        return res.status(400).json({ error: "Value is required and must be a string" });
      }
      
      const updated = await storage.updateContent(key, value);
      
      if (!updated) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating content:", error);
      res.status(500).json({ error: "Failed to update content" });
    }
  });

  // Update session (admin - can update sessionType, status, etc.)
  app.patch("/api/admin/sessions/:id", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const { sessionType, status } = req.body;

      const updates: Record<string, any> = {};

      if (sessionType && ['lifestyle', 'living', 'taste'].includes(sessionType)) {
        updates.sessionType = sessionType;
      }

      if (status && ['in_progress', 'completed'].includes(status)) {
        updates.status = status;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid updates provided. Allowed: sessionType, status" });
      }

      const session = await storage.updateSession(id, updates);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  // ===== PDF EXPORT =====

  app.get("/api/sessions/:id/export/pdf", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Create filename with client name and optional project
      const clientSlug = session.clientName.replace(/[^a-zA-Z0-9]/g, "_");
      const projectSlug = session.projectName ? `-${session.projectName.replace(/[^a-zA-Z0-9]/g, "_")}` : "";

      // Check session type and generate appropriate PDF
      const sessionType = (session as any).sessionType || 'lifestyle';

      if (sessionType === 'living') {
        // Generate Living PDF (form-based questionnaire)
        const livingResponses = await storage.getLivingResponsesBySession(id);
        const pdfBuffer = await generateLivingPdfBuffer(session, livingResponses);
        const filename = `LuXeBrief-Living-${clientSlug}${projectSlug}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      } else {
        // Generate Lifestyle PDF (audio-based questionnaire)
        const responses = await storage.getResponsesBySession(id);
        const report = await storage.getReport(id);

        if (!report) {
          return res.status(404).json({ error: "Report not found" });
        }

        const allQuestions = await storage.getActiveQuestions();
        const sections = {
          summary: report.summary,
          designPreferences: report.designPreferences || "",
          functionalNeeds: report.functionalNeeds || "",
          lifestyleElements: report.lifestyleElements || "",
          additionalNotes: report.additionalNotes || "",
        };

        const pdfBuffer = await generatePdfBuffer(session, responses, sections, allQuestions);
        const filename = `LuXeBrief-Lifestyle-${clientSlug}${projectSlug}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // Serve stored PDF directly from file system
  // This endpoint serves the PDF that was saved during session completion
  // Path: {DATA_DIR}/briefings/{client-name}-{sessionId}/reports/report.pdf
  app.get("/api/sessions/:id/stored-pdf", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);

      if (!session) {
        console.log(`[Stored PDF] Session ${id} not found`);
        return res.status(404).json({ error: "Session not found" });
      }

      // Get the stored PDF path from the report record
      const report = await storage.getReport(id);

      if (report?.pdfFilePath) {
        // Serve from stored file path
        console.log(`[Stored PDF] Serving from pdfFilePath: ${report.pdfFilePath}`);
        const pdfBuffer = await CloudStorageService.readFile(report.pdfFilePath);

        if (pdfBuffer) {
          const clientSlug = session.clientName.replace(/[^a-zA-Z0-9]/g, "_");
          const sessionType = (session as any).sessionType || 'lifestyle';
          const typeLabel = sessionType === 'living' ? 'Living' : 'Lifestyle';
          const filename = `LuXeBrief-${typeLabel}-${clientSlug}.pdf`;

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          return res.send(pdfBuffer);
        }
      }

      // Fallback: construct path and try to read directly
      console.log(`[Stored PDF] No pdfFilePath in report, trying constructed path`);
      const storedPath = CloudStorageService.getSessionPath(session.clientName, id);
      const pdfPath = `${storedPath}/reports/report.pdf`;

      console.log(`[Stored PDF] Trying path: ${pdfPath}`);
      const pdfBuffer = await CloudStorageService.readFile(pdfPath);

      if (!pdfBuffer) {
        console.log(`[Stored PDF] No PDF found at ${pdfPath}`);
        return res.status(404).json({ error: "Stored PDF not found" });
      }

      const clientSlug = session.clientName.replace(/[^a-zA-Z0-9]/g, "_");
      const sessionType = (session as any).sessionType || 'lifestyle';
      const typeLabel = sessionType === 'living' ? 'Living' : 'Lifestyle';
      const filename = `LuXeBrief-${typeLabel}-${clientSlug}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("[Stored PDF] Error:", error);
      res.status(500).json({ error: "Failed to retrieve stored PDF" });
    }
  });

  // ===== TASTE EXPLORATION ROUTES =====

  // Get taste session by access token (for client questionnaire)
  app.get("/api/taste/session/:token", async (req: Request, res: ExpressResponse) => {
    try {
      const { token } = req.params;
      const session = await storage.getSessionByToken(token);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.sessionType !== "taste") {
        return res.status(400).json({ error: "Invalid session type" });
      }

      // Include taste selections
      const selections = await storage.getTasteSelectionsBySession(session.id);
      const profile = await storage.getTasteProfile(session.id);

      res.json({ ...session, selections, profile });
    } catch (error) {
      console.error("[Taste] Error fetching session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Save a taste selection
  app.post("/api/taste/sessions/:id/selection", async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { quadId, favorite1, favorite2, leastFavorite, isSkipped } = req.body;

      if (!quadId) {
        return res.status(400).json({ error: "quadId is required" });
      }

      const selection = await storage.createOrUpdateTasteSelection(sessionId, quadId, {
        favorite1: isSkipped ? null : favorite1,
        favorite2: isSkipped ? null : favorite2,
        leastFavorite: isSkipped ? null : leastFavorite,
        isSkipped: isSkipped || false,
      });

      res.json(selection);
    } catch (error) {
      console.error("[Taste] Error saving selection:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Complete taste session
  app.post("/api/taste/sessions/:id/complete", async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get all selections
      const selections = await storage.getTasteSelectionsBySession(sessionId);

      // Calculate profile
      const profileResult = calculateTasteProfile(selections);

      // Save profile
      const profile = await storage.createOrUpdateTasteProfile(sessionId, {
        warmthScore: Math.round(profileResult.scores.warmth * 10),
        formalityScore: Math.round(profileResult.scores.formality * 10),
        dramaScore: Math.round(profileResult.scores.drama * 10),
        traditionScore: Math.round(profileResult.scores.tradition * 10),
        opennessScore: Math.round(profileResult.scores.openness * 10),
        artFocusScore: Math.round(profileResult.scores.art_focus * 10),
        completedQuads: profileResult.completedQuads,
        skippedQuads: profileResult.skippedQuads,
        totalQuads: profileResult.totalQuads,
        topMaterials: JSON.stringify(profileResult.topMaterials),
      });

      // Mark session as complete
      await storage.updateSession(sessionId, {
        status: "completed",
        completedAt: new Date(),
      });

      const completedSession = await storage.getSession(sessionId);
      res.json({
        session: completedSession,
        profile,
        profileResult,
      });
    } catch (error) {
      console.error("[Taste] Error completing session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get taste profile (for N4S integration)
  app.get("/api/taste/sessions/:id/profile", adminAuth, async (req: Request, res: ExpressResponse) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const profile = await storage.getTasteProfile(sessionId);
      const selections = await storage.getTasteSelectionsBySession(sessionId);

      // Format selections for N4S
      const formattedSelections: Record<string, { favorites: number[]; least: number | null }> = {};
      selections.forEach((sel) => {
        if (!sel.isSkipped && sel.favorite1 !== null && sel.favorite2 !== null) {
          formattedSelections[sel.quadId] = {
            favorites: [sel.favorite1, sel.favorite2],
            least: sel.leastFavorite,
          };
        }
      });

      res.json({
        session: {
          clientId: session.n4sPrincipalType === "principal"
            ? `${session.subdomain || 'unknown'}-P`
            : `${session.subdomain || 'unknown'}-S`,
          completedAt: session.completedAt,
        },
        selections: formattedSelections,
        profile: profile ? {
          scores: {
            warmth: (profile.warmthScore || 50) / 10,
            formality: (profile.formalityScore || 50) / 10,
            drama: (profile.dramaScore || 50) / 10,
            tradition: (profile.traditionScore || 50) / 10,
            openness: (profile.opennessScore || 50) / 10,
            art_focus: (profile.artFocusScore || 50) / 10,
          },
          topMaterials: profile.topMaterials ? JSON.parse(profile.topMaterials) : [],
          completedQuads: profile.completedQuads,
          skippedQuads: profile.skippedQuads,
          totalQuads: profile.totalQuads,
        } : null,
      });
    } catch (error) {
      console.error("[Taste] Error fetching profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get taste quads data (for client)
  // Returns array of TasteQuad objects directly
  app.get("/api/taste/quads", async (req: Request, res: ExpressResponse) => {
    res.json(tasteQuads);
  });

  return httpServer;
}

// Calculate taste profile from selections
function calculateTasteProfile(selections: TasteSelection[]): TasteProfileResult {
  const scores: Record<string, number> = {
    warmth: 0,
    formality: 0,
    drama: 0,
    tradition: 0,
    openness: 0,
    art_focus: 0,
  };

  let totalWeight = 0;
  let completedQuads = 0;
  let skippedQuads = 0;

  for (const selection of selections) {
    if (selection.isSkipped) {
      skippedQuads++;
      continue;
    }

    const quad = tasteQuads.find((q) => q.quadId === selection.quadId);
    if (!quad || !quad.attributes) {
      continue;
    }

    completedQuads++;

    // Process favorite 1
    if (selection.favorite1 !== null && selection.favorite1 !== undefined) {
      const idx = selection.favorite1;
      totalWeight += Math.abs(TASTE_SELECTION_WEIGHTS.FAVORITE_1);

      for (const [attr, values] of Object.entries(quad.attributes)) {
        if (Array.isArray(values) && values[idx] !== undefined && scores[attr] !== undefined) {
          scores[attr] += values[idx] * TASTE_SELECTION_WEIGHTS.FAVORITE_1;
        }
      }
    }

    // Process favorite 2
    if (selection.favorite2 !== null && selection.favorite2 !== undefined) {
      const idx = selection.favorite2;
      totalWeight += Math.abs(TASTE_SELECTION_WEIGHTS.FAVORITE_2);

      for (const [attr, values] of Object.entries(quad.attributes)) {
        if (Array.isArray(values) && values[idx] !== undefined && scores[attr] !== undefined) {
          scores[attr] += values[idx] * TASTE_SELECTION_WEIGHTS.FAVORITE_2;
        }
      }
    }

    // Process least favorite
    if (selection.leastFavorite !== null && selection.leastFavorite !== undefined) {
      const idx = selection.leastFavorite;
      totalWeight += Math.abs(TASTE_SELECTION_WEIGHTS.LEAST);

      for (const [attr, values] of Object.entries(quad.attributes)) {
        if (Array.isArray(values) && values[idx] !== undefined && scores[attr] !== undefined) {
          scores[attr] += values[idx] * TASTE_SELECTION_WEIGHTS.LEAST;
        }
      }
    }
  }

  // Normalize scores to 1-10 scale
  const normalizedScores: Record<string, number> = {};
  for (const attr of ['warmth', 'formality', 'drama', 'tradition', 'openness', 'art_focus']) {
    normalizedScores[attr] = totalWeight > 0
      ? Math.min(10, Math.max(1, Math.round((scores[attr] / totalWeight + 5) * 10) / 10))
      : 5;
  }

  return {
    scores: normalizedScores as TasteProfileResult['scores'],
    topMaterials: [],
    completedQuads,
    skippedQuads,
    totalQuads: tasteQuads.length,
  };
}

// N4S Brand Colors
const N4S_NAVY = "#1e3a5f";
const N4S_GOLD = "#c9a227";
const N4S_TEXT = "#1a1a1a";
const N4S_MUTED = "#6b6b6b";

// Helper to generate PDF buffer with N4S Brand styling
async function generatePdfBuffer(
  session: Session,
  responses: DBResponse[],
  sections: { summary: string; designPreferences: string; functionalNeeds: string; lifestyleElements: string; additionalNotes: string },
  allQuestions: Question[]
): Promise<Buffer> {
  // Track pages for "Page X of Y" footer
  const pages: Buffer[][] = [];
  let currentPageChunks: Buffer[] = [];

  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    bufferPages: true  // Enable buffering to add page numbers later
  });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 50;
  const contentWidth = pageWidth - (margin * 2);
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const projectDisplay = session.projectName || "Luxury Residence Project";

  // Helper function to add header and footer to each page
  const addPageHeaderFooter = () => {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);

      // Footer: © 2026 Not4Sale LLC | Page X of Y
      doc.fontSize(8)
         .fillColor(N4S_MUTED)
         .text(
           `© 2026 Not4Sale LLC`,
           margin,
           pageHeight - 30,
           { continued: true, width: contentWidth / 2 }
         )
         .text(
           `Page ${i + 1} of ${pageCount}`,
           margin + contentWidth / 2,
           pageHeight - 30,
           { align: 'right', width: contentWidth / 2 }
         );
    }
  };

  // ========== PAGE 1: Title Page ==========

  // Navy header bar
  doc.rect(0, 0, pageWidth, 60).fill(N4S_NAVY);

  // N4S Logo text
  doc.fontSize(14).fillColor('#ffffff').text("N4S", margin, 22);
  doc.fontSize(9).fillColor('#ffffff').text("Luxury Residential Advisory", margin, 38);

  // Report type and date on right
  doc.fontSize(10).fillColor('#ffffff').text("LuXeBrief Lifestyle Brief", pageWidth - margin - 150, 22, { width: 150, align: 'right' });
  doc.fontSize(9).fillColor('#ffffff').text(generatedDate, pageWidth - margin - 150, 38, { width: 150, align: 'right' });

  doc.moveDown(5);

  // Project and Client info
  doc.y = 100;
  doc.fontSize(11).fillColor(N4S_TEXT).font('Helvetica-Bold').text("Project: ", margin, doc.y, { continued: true });
  doc.font("Helvetica").text(projectDisplay);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').text("Client: ", { continued: true });
  doc.font("Helvetica").text(session.clientName);

  doc.moveDown(3);

  // Main Title
  doc.fontSize(24).fillColor(N4S_NAVY).font('Helvetica-Bold').text("LuXeBrief Lifestyle Brief", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(N4S_MUTED).font("Helvetica").text("A comprehensive summary of your vision for ultra-luxury living", { align: "center" });

  doc.moveDown(3);

  // Executive Summary
  doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Executive Summary");
  doc.moveDown(0.5);
  doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
  doc.moveDown(0.8);
  doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(sections.summary || "No summary available.", { lineGap: 4 });
  doc.moveDown(1.5);

  // Design Preferences
  if (sections.designPreferences) {
    doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Design Preferences");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(sections.designPreferences, { lineGap: 4 });
    doc.moveDown(1.5);
  }

  // Functional Requirements
  if (sections.functionalNeeds) {
    // Check if we need a new page
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Functional Requirements");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(sections.functionalNeeds, { lineGap: 4 });
    doc.moveDown(1.5);
  }

  // Lifestyle Elements
  if (sections.lifestyleElements) {
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Lifestyle Elements");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(sections.lifestyleElements, { lineGap: 4 });
    doc.moveDown(1.5);
  }

  // Additional Notes
  if (sections.additionalNotes) {
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Additional Notes");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
    doc.moveDown(0.8);
    doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(sections.additionalNotes, { lineGap: 4 });
    doc.moveDown(1.5);
  }

  // ========== RESPONSES PAGE ==========
  doc.addPage();

  // Navy header bar on new page
  doc.rect(0, 0, pageWidth, 40).fill(N4S_NAVY);
  doc.fontSize(12).fillColor('#ffffff').text("Complete Responses", margin, 14);

  doc.y = 60;

  // Group by category
  const categories = ["vision", "design", "functional", "lifestyle", "emotional"] as const;

  for (const category of categories) {
    const categoryQuestions = allQuestions.filter((q: Question) => q.category === category);
    if (categoryQuestions.length === 0) continue;

    // Check if we need a new page
    if (doc.y > pageHeight - 150) {
      doc.addPage();
      doc.rect(0, 0, pageWidth, 40).fill(N4S_NAVY);
      doc.fontSize(12).fillColor('#ffffff').text("Complete Responses (continued)", margin, 14);
      doc.y = 60;
    }

    doc.fontSize(12).fillColor(N4S_NAVY).font('Helvetica-Bold').text(categoryLabels[category as keyof typeof categoryLabels]);
    doc.moveDown(0.5);

    for (const question of categoryQuestions) {
      const response = responses.find(r => r.questionId === question.id);
      if (!response?.transcription) continue;

      // Check if we need a new page
      if (doc.y > pageHeight - 100) {
        doc.addPage();
        doc.rect(0, 0, pageWidth, 40).fill(N4S_NAVY);
        doc.fontSize(12).fillColor('#ffffff').text("Complete Responses (continued)", margin, 14);
        doc.y = 60;
      }

      doc.fontSize(10).fillColor(N4S_TEXT).font('Helvetica-Bold').text(question.question);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor(N4S_MUTED).font("Helvetica").text(response.transcription, { indent: 15, lineGap: 3 });
      doc.moveDown(1);
    }
    doc.moveDown(0.5);
  }

  // Add headers and footers to all pages
  addPageHeaderFooter();

  doc.end();

  return pdfPromise;
}

// Generate PDF for Living questionnaire (form-based)
async function generateLivingPdfBuffer(
  session: Session,
  livingResponses: LivingResponse[]
): Promise<Buffer> {
  const doc = new PDFDocument({
    margin: 50,
    size: 'A4',
    bufferPages: true
  });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 50;
  const contentWidth = pageWidth - (margin * 2);
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const projectDisplay = session.projectName || "Luxury Residence Project";

  // Helper function to add header and footer to each page
  const addPageHeaderFooter = () => {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
         .fillColor(N4S_MUTED)
         .text(`© 2026 Not4Sale LLC`, margin, pageHeight - 30, { continued: true, width: contentWidth / 2 })
         .text(`Page ${i + 1} of ${pageCount}`, margin + contentWidth / 2, pageHeight - 30, { align: 'right', width: contentWidth / 2 });
    }
  };

  // Parse response data from JSON strings
  const responseDataMap: Record<string, any> = {};
  for (const response of livingResponses) {
    try {
      responseDataMap[response.stepId] = JSON.parse(response.data);
    } catch {
      responseDataMap[response.stepId] = {};
    }
  }

  // ========== TITLE PAGE ==========
  // Navy header bar
  doc.rect(0, 0, pageWidth, 60).fill(N4S_NAVY);
  doc.fontSize(14).fillColor('#ffffff').text("N4S", margin, 22);
  doc.fontSize(9).fillColor('#ffffff').text("Luxury Residential Advisory", margin, 38);
  doc.fontSize(10).fillColor('#ffffff').text("LuXeBrief Living Brief", pageWidth - margin - 150, 22, { width: 150, align: 'right' });
  doc.fontSize(9).fillColor('#ffffff').text(generatedDate, pageWidth - margin - 150, 38, { width: 150, align: 'right' });

  doc.y = 100;
  doc.fontSize(11).fillColor(N4S_TEXT).font('Helvetica-Bold').text("Project: ", margin, doc.y, { continued: true });
  doc.font("Helvetica").text(projectDisplay);
  doc.moveDown(0.3);
  doc.font('Helvetica-Bold').text("Client: ", { continued: true });
  doc.font("Helvetica").text(session.clientName);

  doc.moveDown(3);
  doc.fontSize(24).fillColor(N4S_NAVY).font('Helvetica-Bold').text("LuXeBrief Living Brief", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor(N4S_MUTED).font("Helvetica").text("Comprehensive space program and living requirements", { align: "center" });
  doc.moveDown(3);

  // ========== SECTION RENDERING HELPER ==========
  const renderSection = (title: string, content: string | string[] | undefined) => {
    if (!content || (Array.isArray(content) && content.length === 0)) return;

    if (doc.y > pageHeight - 150) doc.addPage();

    doc.fontSize(14).fillColor(N4S_NAVY).font('Helvetica-Bold').text(title);
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 60, doc.y).strokeColor(N4S_GOLD).lineWidth(2).stroke();
    doc.moveDown(0.8);

    if (Array.isArray(content)) {
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(content.join(", "), { lineGap: 4 });
    } else {
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(content, { lineGap: 4 });
    }
    doc.moveDown(1.5);
  };

  const renderYesNo = (label: string, value: boolean | undefined) => {
    if (value === undefined) return;
    doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica")
      .text(`${label}: `, { continued: true })
      .fillColor(value ? '#2dd4bf' : N4S_MUTED)
      .text(value ? 'Yes' : 'No');
    doc.moveDown(0.5);
  };

  // ========== WORK & PRODUCTIVITY ==========
  const workData = responseDataMap['work'] || {};
  if (Object.keys(workData).length > 0) {
    doc.fontSize(16).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Work & Productivity");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 80, doc.y).strokeColor(N4S_GOLD).lineWidth(3).stroke();
    doc.moveDown(1);

    const wfhLabels: Record<string, string> = {
      'never': 'Never',
      'sometimes': 'Sometimes (1-2 days/week)',
      'often': 'Often (3-4 days/week)',
      'always': 'Always (Full Remote)'
    };

    if (workData.workFromHome) {
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica")
        .text(`Work from Home Frequency: ${wfhLabels[workData.workFromHome] || workData.workFromHome}`);
      doc.moveDown(0.5);
    }
    if (workData.wfhPeopleCount) {
      doc.text(`People Working from Home: ${workData.wfhPeopleCount}`);
      doc.moveDown(0.5);
    }
    renderYesNo("Separate Offices Required", workData.separateOfficesRequired);
    if (workData.officeRequirements) {
      doc.moveDown(0.5);
      doc.text(`Office Requirements: ${workData.officeRequirements}`);
    }
    doc.moveDown(1.5);
  }

  // ========== HOBBIES & ACTIVITIES ==========
  const hobbiesData = responseDataMap['hobbies'] || {};
  if (Object.keys(hobbiesData).length > 0) {
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(16).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Hobbies & Activities");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 80, doc.y).strokeColor(N4S_GOLD).lineWidth(3).stroke();
    doc.moveDown(1);

    if (hobbiesData.hobbies?.length) {
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica")
        .text(`Space-Requiring Hobbies: ${hobbiesData.hobbies.join(", ")}`);
      doc.moveDown(0.5);
    }
    if (hobbiesData.hobbyDetails) {
      doc.text(`Details: ${hobbiesData.hobbyDetails}`);
      doc.moveDown(0.5);
    }
    renderYesNo("Late Night Media Use", hobbiesData.lateNightMediaUse);
    doc.moveDown(1.5);
  }

  // ========== ENTERTAINING ==========
  const entertainingData = responseDataMap['entertaining'] || {};
  if (Object.keys(entertainingData).length > 0) {
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(16).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Entertaining");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 80, doc.y).strokeColor(N4S_GOLD).lineWidth(3).stroke();
    doc.moveDown(1);

    if (entertainingData.entertainingFrequency) {
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica")
        .text(`Frequency: ${entertainingData.entertainingFrequency}`);
      doc.moveDown(0.5);
    }
    if (entertainingData.entertainingStyle) {
      doc.text(`Style: ${entertainingData.entertainingStyle}`);
      doc.moveDown(0.5);
    }
    if (entertainingData.typicalGuestCount) {
      doc.text(`Typical Guest Count: ${entertainingData.typicalGuestCount}`);
    }
    doc.moveDown(1.5);
  }

  // ========== WELLNESS & PRIVACY ==========
  const wellnessData = responseDataMap['wellness'] || {};
  if (Object.keys(wellnessData).length > 0) {
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(16).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Wellness & Privacy");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 80, doc.y).strokeColor(N4S_GOLD).lineWidth(3).stroke();
    doc.moveDown(1);

    if (wellnessData.wellnessPriorities?.length) {
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica")
        .text(`Wellness Priorities: ${wellnessData.wellnessPriorities.join(", ")}`);
      doc.moveDown(0.5);
    }
    if (wellnessData.privacyLevelRequired) {
      doc.text(`Privacy Level: ${wellnessData.privacyLevelRequired}/5`);
      doc.moveDown(0.5);
    }
    if (wellnessData.noiseSensitivity) {
      doc.text(`Noise Sensitivity: ${wellnessData.noiseSensitivity}/5`);
      doc.moveDown(0.5);
    }
    if (wellnessData.indoorOutdoorLiving) {
      doc.text(`Indoor-Outdoor Integration: ${wellnessData.indoorOutdoorLiving}/5`);
    }
    doc.moveDown(1.5);
  }

  // ========== INTERIOR SPACES ==========
  const interiorData = responseDataMap['interior'] || {};
  if (Object.keys(interiorData).length > 0) {
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(16).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Interior Spaces");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 80, doc.y).strokeColor(N4S_GOLD).lineWidth(3).stroke();
    doc.moveDown(1);

    if (interiorData.mustHaveSpaces?.length) {
      doc.fontSize(12).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Must Have:");
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(interiorData.mustHaveSpaces.join(", "));
      doc.moveDown(0.8);
    }
    if (interiorData.niceToHaveSpaces?.length) {
      doc.fontSize(12).fillColor(N4S_GOLD).font('Helvetica-Bold').text("Would Like (if desired total sq footage and budget allows):");
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(interiorData.niceToHaveSpaces.join(", "));
      doc.moveDown(0.8);
    }

    // Clarification questions
    doc.fontSize(12).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Space Clarifications:");
    doc.moveDown(0.3);
    renderYesNo("Separate Family Room", interiorData.wantsSeparateFamilyRoom);
    renderYesNo("Second Formal Living", interiorData.wantsSecondFormalLiving);
    renderYesNo("Built-in Bar", interiorData.wantsBar);
    renderYesNo("Kids Bunk Room", interiorData.wantsBunkRoom);
    renderYesNo("Breakfast Nook", interiorData.wantsBreakfastNook);
    doc.moveDown(1.5);
  }

  // ========== EXTERIOR AMENITIES ==========
  const exteriorData = responseDataMap['exterior'] || {};
  if (Object.keys(exteriorData).length > 0) {
    doc.addPage();
    doc.rect(0, 0, pageWidth, 40).fill(N4S_NAVY);
    doc.fontSize(12).fillColor('#ffffff').text("Exterior Amenities", margin, 14);
    doc.y = 60;

    const renderExteriorCategory = (title: string, mustHave: string[] | undefined, wouldLike: string[] | undefined) => {
      if ((!mustHave || mustHave.length === 0) && (!wouldLike || wouldLike.length === 0)) return;

      doc.fontSize(13).fillColor(N4S_NAVY).font('Helvetica-Bold').text(title);
      doc.moveDown(0.3);
      if (mustHave?.length) {
        doc.fontSize(10).fillColor('#2dd4bf').font('Helvetica-Bold').text("Must Have: ", { continued: true });
        doc.fillColor(N4S_TEXT).font("Helvetica").text(mustHave.join(", "));
      }
      if (wouldLike?.length) {
        doc.fontSize(10).fillColor(N4S_GOLD).font('Helvetica-Bold').text("Would Like: ", { continued: true });
        doc.fillColor(N4S_TEXT).font("Helvetica").text(wouldLike.join(", "));
      }
      doc.moveDown(1);
    };

    renderExteriorCategory("Pool & Water Features", exteriorData.mustHavePoolWater, exteriorData.wouldLikePoolWater);
    renderExteriorCategory("Sport & Recreation", exteriorData.mustHaveSport, exteriorData.wouldLikeSport);
    renderExteriorCategory("Outdoor Living", exteriorData.mustHaveOutdoorLiving, exteriorData.wouldLikeOutdoorLiving);
    renderExteriorCategory("Gardens & Landscaping", exteriorData.mustHaveGarden, exteriorData.wouldLikeGarden);
    renderExteriorCategory("Structures", exteriorData.mustHaveStructures, exteriorData.wouldLikeStructures);
    renderExteriorCategory("Access & Entry", exteriorData.mustHaveAccess, exteriorData.wouldLikeAccess);
  }

  // ========== FINAL DETAILS ==========
  const finalData = responseDataMap['final'] || {};
  if (Object.keys(finalData).length > 0) {
    if (doc.y > pageHeight - 200) doc.addPage();

    doc.fontSize(16).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Garage, Technology & Details");
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + 80, doc.y).strokeColor(N4S_GOLD).lineWidth(3).stroke();
    doc.moveDown(1);

    if (finalData.garageSize) {
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(`Garage Size: ${finalData.garageSize} cars`);
      doc.moveDown(0.5);
    }
    if (finalData.garageFeatures?.length) {
      doc.text(`Garage Features: ${finalData.garageFeatures.join(", ")}`);
      doc.moveDown(0.5);
    }
    if (finalData.technologyRequirements?.length) {
      doc.text(`Technology: ${finalData.technologyRequirements.join(", ")}`);
      doc.moveDown(0.5);
    }
    if (finalData.sustainabilityPriorities?.length) {
      doc.text(`Sustainability: ${finalData.sustainabilityPriorities.join(", ")}`);
      doc.moveDown(0.5);
    }
    if (finalData.viewPriorityRooms?.length) {
      doc.text(`View Priority Rooms: ${finalData.viewPriorityRooms.join(", ")}`);
      doc.moveDown(0.5);
    }
    if (finalData.minimumLotSize) {
      doc.text(`Minimum Lot Size: ${finalData.minimumLotSize}`);
      doc.moveDown(0.5);
    }
    if (finalData.minimumSetback) {
      doc.text(`Minimum Setback: ${finalData.minimumSetback}`);
      doc.moveDown(0.5);
    }
    if (finalData.currentSpacePainPoints) {
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Current Space Pain Points:");
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(finalData.currentSpacePainPoints);
    }
    if (finalData.dailyRoutinesSummary) {
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor(N4S_NAVY).font('Helvetica-Bold').text("Daily Routines:");
      doc.fontSize(11).fillColor(N4S_TEXT).font("Helvetica").text(finalData.dailyRoutinesSummary);
    }
  }

  // Add headers and footers to all pages
  addPageHeaderFooter();

  doc.end();

  return pdfPromise;
}

// Helper to parse AI summary into sections
function parseSummarySections(fullText: string) {
  const sections = {
    summary: "",
    designPreferences: "",
    functionalNeeds: "",
    lifestyleElements: "",
    additionalNotes: "",
  };

  // Remove markdown bold/italic formatting that bleeds into PDF
  const cleanText = fullText.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

  // Try to extract sections based on headings
  const lines = cleanText.split("\n");
  let currentSection = "summary";
  let currentContent: string[] = [];

  // Section header patterns - check if a line is a section header
  const sectionPatterns: Record<string, RegExp[]> = {
    summary: [/^executive\s+summary/i, /^summary/i, /^overview/i],
    designPreferences: [/^design\s+preference/i, /^aesthetic/i, /^style/i],
    functionalNeeds: [/^functional\s+requirement/i, /^functional/i, /^practical/i],
    lifestyleElements: [/^lifestyle\s+element/i, /^lifestyle/i, /^entertainment/i, /^daily/i],
    additionalNotes: [/^additional\s+note/i, /^additional/i, /^recommendation/i, /^other/i],
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if this line is a section header
    let isHeader = false;
    let newSection = currentSection;

    for (const [section, patterns] of Object.entries(sectionPatterns)) {
      if (patterns.some(pattern => pattern.test(trimmedLine))) {
        // Only treat as header if the line is short (likely a heading, not content)
        if (trimmedLine.length < 60) {
          isHeader = true;
          newSection = section;
          break;
        }
      }
    }

    if (isHeader && newSection !== currentSection) {
      // Save current section content before switching
      if (currentContent.length > 0) {
        sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
      }
      currentSection = newSection;
      currentContent = [];
    } else if (!isHeader) {
      // Add content line (not a header)
      currentContent.push(trimmedLine);
    }
  }

  // Save the last section
  if (currentContent.length > 0) {
    sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
  }

  // CRITICAL FALLBACK: If summary is empty but we have content, use it
  if (!sections.summary && cleanText.trim()) {
    // If other sections have content, try to extract first paragraphs
    const allText = cleanText.trim();
    const paragraphs = allText.split(/\n\n+/).filter(p => p.trim());

    if (paragraphs.length > 0) {
      // Use first 2-3 paragraphs as summary
      sections.summary = paragraphs.slice(0, 3).join("\n\n");
    } else {
      // Use everything
      sections.summary = allText;
    }
  }

  // Absolute final fallback - never show "No summary available" if AI returned content
  if (!sections.summary) {
    sections.summary = cleanText.trim() || "Summary generation in progress.";
  }

  return sections;
}

import type { Express, Request, Response as ExpressResponse, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { categoryLabels, type Question, type Session, type Response as DBResponse, insertQuestionSchema } from "@shared/schema";
import OpenAI, { toFile } from "openai";
import PDFDocument from "pdfkit";
import { Buffer, File } from "node:buffer";
import { CloudStorageService } from "./cloudStorage";

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
      const { clientName } = req.body;
      if (!clientName || typeof clientName !== "string") {
        return res.status(400).json({ error: "Client name is required" });
      }
      
      // Create session first to get the ID
      const session = await storage.createSession({ 
        clientName,
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

  // Get session with responses
  app.get("/api/sessions/:id", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const responses = await storage.getResponsesBySession(id);
      res.json({ ...session, responses });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
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
      const report = await storage.getReport(id);
      
      res.json({ ...session, responses, report });
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
              content: `You are an expert luxury residence design consultant. Analyze the client briefing responses and create a comprehensive design brief summary. Be professional, insightful, and highlight key themes and preferences.`
            },
            {
              role: "user",
              content: `Please analyze these client briefing responses for an ultra-luxury private residence and provide:

1. An executive summary (2-3 paragraphs) capturing the client's overall vision
2. Key design preferences extracted from their responses
3. Functional requirements and practical needs
4. Lifestyle elements and entertainment preferences
5. Any additional notes or recommendations

Client: ${session.clientName}

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
      let contentType = "application/octet-stream";
      if (filePath.endsWith(".webm")) contentType = "audio/webm";
      else if (filePath.endsWith(".wav")) contentType = "audio/wav";
      else if (filePath.endsWith(".txt")) contentType = "text/plain; charset=utf-8";
      else if (filePath.endsWith(".json")) contentType = "application/json";
      else if (filePath.endsWith(".pdf")) contentType = "application/pdf";
      
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

  // ===== PDF EXPORT =====
  
  app.get("/api/sessions/:id/export/pdf", async (req: Request, res: ExpressResponse) => {
    try {
      const id = parseInt(req.params.id as string);
      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      const responses = await storage.getResponsesBySession(id);
      const report = await storage.getReport(id);
      
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      // Generate PDF
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      
      doc.on("data", (chunk) => chunks.push(chunk));
      
      const pdfPromise = new Promise<Buffer>((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
      });
      
      // Title
      doc.fontSize(24).font("Helvetica-Bold").text("Design Brief", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(16).font("Helvetica").text(`${session.clientName}`, { align: "center" });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });
      doc.moveDown(2);
      
      // Executive Summary
      doc.fontSize(14).font("Helvetica-Bold").text("Executive Summary");
      doc.moveDown(0.5);
      doc.fontSize(11).font("Helvetica").text(report.summary);
      doc.moveDown(1.5);
      
      // Design Preferences
      if (report.designPreferences) {
        doc.fontSize(14).font("Helvetica-Bold").text("Design Preferences");
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica").text(report.designPreferences);
        doc.moveDown(1.5);
      }
      
      // Functional Requirements
      if (report.functionalNeeds) {
        doc.fontSize(14).font("Helvetica-Bold").text("Functional Requirements");
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica").text(report.functionalNeeds);
        doc.moveDown(1.5);
      }
      
      // Lifestyle Elements
      if (report.lifestyleElements) {
        doc.fontSize(14).font("Helvetica-Bold").text("Lifestyle Elements");
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica").text(report.lifestyleElements);
        doc.moveDown(1.5);
      }
      
      // Additional Notes
      if (report.additionalNotes) {
        doc.fontSize(14).font("Helvetica-Bold").text("Additional Notes");
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica").text(report.additionalNotes);
        doc.moveDown(1.5);
      }
      
      // Add new page for full responses
      doc.addPage();
      doc.fontSize(16).font("Helvetica-Bold").text("Complete Responses", { align: "center" });
      doc.moveDown(1);
      
      // Fetch all questions from storage
      const allQuestions = await storage.getActiveQuestions();
      
      // Group by category
      const categories = ["vision", "design", "functional", "lifestyle", "emotional"] as const;
      
      for (const category of categories) {
        const categoryQuestions = allQuestions.filter((q: Question) => q.category === category);
        if (categoryQuestions.length === 0) continue;
        
        doc.fontSize(12).font("Helvetica-Bold").text(categoryLabels[category as keyof typeof categoryLabels]);
        doc.moveDown(0.5);
        
        for (const question of categoryQuestions) {
          const response = responses.find(r => r.questionId === question.id);
          
          doc.fontSize(10).font("Helvetica-Bold").text(question.question);
          doc.fontSize(10).font("Helvetica").text(
            response?.transcription || "No response recorded",
            { indent: 20 }
          );
          doc.moveDown(0.5);
        }
        
        doc.moveDown(1);
      }
      
      doc.end();
      
      const pdfBuffer = await pdfPromise;
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${session.clientName.replace(/[^a-zA-Z0-9]/g, "_")}-design-brief.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  return httpServer;
}

// Helper to generate PDF buffer
async function generatePdfBuffer(
  session: Session,
  responses: DBResponse[],
  sections: { summary: string; designPreferences: string; functionalNeeds: string; lifestyleElements: string; additionalNotes: string },
  allQuestions: Question[]
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  
  doc.on("data", (chunk) => chunks.push(chunk));
  
  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  
  // Title
  doc.fontSize(24).font("Helvetica-Bold").text("Design Brief", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(16).font("Helvetica").text(`${session.clientName}`, { align: "center" });
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });
  doc.moveDown(2);
  
  // Executive Summary
  doc.fontSize(14).font("Helvetica-Bold").text("Executive Summary");
  doc.moveDown(0.5);
  doc.fontSize(11).font("Helvetica").text(sections.summary || "No summary available.");
  doc.moveDown(1.5);
  
  // Design Preferences
  if (sections.designPreferences) {
    doc.fontSize(14).font("Helvetica-Bold").text("Design Preferences");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(sections.designPreferences);
    doc.moveDown(1.5);
  }
  
  // Functional Requirements
  if (sections.functionalNeeds) {
    doc.fontSize(14).font("Helvetica-Bold").text("Functional Requirements");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(sections.functionalNeeds);
    doc.moveDown(1.5);
  }
  
  // Lifestyle Elements
  if (sections.lifestyleElements) {
    doc.fontSize(14).font("Helvetica-Bold").text("Lifestyle Elements");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(sections.lifestyleElements);
    doc.moveDown(1.5);
  }
  
  // Additional Notes
  if (sections.additionalNotes) {
    doc.fontSize(14).font("Helvetica-Bold").text("Additional Notes");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(sections.additionalNotes);
    doc.moveDown(1.5);
  }
  
  // Add new page for full responses
  doc.addPage();
  doc.fontSize(16).font("Helvetica-Bold").text("Complete Responses", { align: "center" });
  doc.moveDown(1);
  
  // Group by category
  const categories = ["vision", "design", "functional", "lifestyle", "emotional"] as const;
  
  for (const category of categories) {
    const categoryQuestions = allQuestions.filter((q: Question) => q.category === category);
    if (categoryQuestions.length === 0) continue;
    
    doc.fontSize(12).font("Helvetica-Bold").text(categoryLabels[category as keyof typeof categoryLabels]);
    doc.moveDown(0.5);
    
    for (const question of categoryQuestions) {
      const response = responses.find(r => r.questionId === question.id);
      if (!response?.transcription) continue;
      
      doc.fontSize(10).font("Helvetica-Bold").text(question.question);
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(response.transcription, { indent: 20 });
      doc.moveDown(1);
    }
    doc.moveDown(0.5);
  }
  
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
  
  // Try to extract sections based on common patterns
  const lines = fullText.split("\n");
  let currentSection = "summary";
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();
    
    if (lowerLine.includes("executive summary") || lowerLine.includes("overall vision")) {
      if (currentContent.length) {
        sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
      }
      currentSection = "summary";
      currentContent = [];
    } else if (lowerLine.includes("design preference") || lowerLine.includes("aesthetic")) {
      if (currentContent.length) {
        sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
      }
      currentSection = "designPreferences";
      currentContent = [];
    } else if (lowerLine.includes("functional") || lowerLine.includes("requirement") || lowerLine.includes("practical")) {
      if (currentContent.length) {
        sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
      }
      currentSection = "functionalNeeds";
      currentContent = [];
    } else if (lowerLine.includes("lifestyle") || lowerLine.includes("entertainment")) {
      if (currentContent.length) {
        sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
      }
      currentSection = "lifestyleElements";
      currentContent = [];
    } else if (lowerLine.includes("additional") || lowerLine.includes("recommendation") || lowerLine.includes("note")) {
      if (currentContent.length) {
        sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
      }
      currentSection = "additionalNotes";
      currentContent = [];
    } else if (line.trim()) {
      currentContent.push(line);
    }
  }
  
  // Save the last section
  if (currentContent.length) {
    sections[currentSection as keyof typeof sections] = currentContent.join("\n").trim();
  }
  
  // If parsing didn't work well, just use the full text as summary
  if (!sections.summary && !sections.designPreferences) {
    sections.summary = fullText;
  }
  
  return sections;
}

import {
  type User,
  type InsertUser,
  type Session,
  type InsertSession,
  type Response,
  type InsertResponse,
  type Report,
  type InsertReport,
  type Question,
  type InsertQuestion,
  type SiteContent,
  type InsertSiteContent,
  defaultQuestions,
  defaultSiteContent,
  users,
  sessions,
  responses,
  reports,
  questions,
  siteContent
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Sessions
  getSession(id: number): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined>;

  // Responses
  getResponsesBySession(sessionId: number): Promise<Response[]>;
  getResponse(sessionId: number, questionId: number): Promise<Response | undefined>;
  createOrUpdateResponse(sessionId: number, questionId: number, data: Partial<InsertResponse>): Promise<Response>;

  // Reports
  getReport(sessionId: number): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;

  // Questions
  getQuestions(): Promise<Question[]>;
  getActiveQuestions(): Promise<Question[]>;
  getQuestion(id: number): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, updates: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  reorderQuestions(orderedIds: number[]): Promise<void>;

  // Site Content
  getAllContent(): Promise<SiteContent[]>;
  getContent(key: string): Promise<SiteContent | undefined>;
  updateContent(key: string, value: string): Promise<SiteContent | undefined>;

  // Initialize (seed defaults if needed)
  initialize(): Promise<void>;
}

export class MySQLStorage implements IStorage {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if questions exist, if not seed defaults
      const existingQuestions = await db.select().from(questions).limit(1);
      if (existingQuestions.length === 0) {
        console.log("Seeding default questions...");
        for (const dq of defaultQuestions) {
          await db.insert(questions).values({
            category: dq.category,
            title: dq.title,
            question: dq.question,
            helpText: dq.helpText ?? null,
            sortOrder: dq.sortOrder,
            isActive: true,
          });
        }
        console.log("Default questions seeded.");
      }

      // Check if site content exists, if not seed defaults
      const existingContent = await db.select().from(siteContent).limit(1);
      if (existingContent.length === 0) {
        console.log("Seeding default site content...");
        for (const dc of defaultSiteContent) {
          await db.insert(siteContent).values({
            key: dc.key,
            value: dc.value,
            label: dc.label,
            section: dc.section,
          });
        }
        console.log("Default site content seeded.");
      }

      this.initialized = true;
      console.log("MySQL storage initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize MySQL storage:", error);
      throw error;
    }
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    await db.insert(users).values({ ...insertUser, id });
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0]!;
  }

  // Sessions
  async getSession(id: number): Promise<Session | undefined> {
    const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0];
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const accessToken = randomUUID();
    const result = await db.insert(sessions).values({
      clientName: insertSession.clientName,
      projectName: insertSession.projectName ?? null,
      accessToken,
      folderPath: insertSession.folderPath ?? null,
      status: insertSession.status || "in_progress",
      currentQuestionIndex: insertSession.currentQuestionIndex ?? 0,
    });

    const insertId = result[0].insertId;
    const session = await db.select().from(sessions).where(eq(sessions.id, insertId)).limit(1);
    return session[0]!;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    const existing = await this.getSession(id);
    if (!existing) return undefined;

    await db.update(sessions).set(updates).where(eq(sessions.id, id));
    return this.getSession(id);
  }

  // Responses
  async getResponsesBySession(sessionId: number): Promise<Response[]> {
    return db.select().from(responses).where(eq(responses.sessionId, sessionId));
  }

  async getResponse(sessionId: number, questionId: number): Promise<Response | undefined> {
    const result = await db.select().from(responses)
      .where(and(eq(responses.sessionId, sessionId), eq(responses.questionId, questionId)))
      .limit(1);
    return result[0];
  }

  async createOrUpdateResponse(
    sessionId: number,
    questionId: number,
    data: Partial<InsertResponse>
  ): Promise<Response> {
    const existing = await this.getResponse(sessionId, questionId);

    if (existing) {
      await db.update(responses).set({
        audioUrl: data.audioUrl !== undefined ? data.audioUrl : existing.audioUrl,
        audioFilePath: data.audioFilePath !== undefined ? data.audioFilePath : existing.audioFilePath,
        transcription: data.transcription !== undefined ? data.transcription : existing.transcription,
        transcriptFilePath: data.transcriptFilePath !== undefined ? data.transcriptFilePath : existing.transcriptFilePath,
        isCompleted: data.isCompleted !== undefined ? data.isCompleted : existing.isCompleted,
      }).where(eq(responses.id, existing.id));

      return (await this.getResponse(sessionId, questionId))!;
    }

    const result = await db.insert(responses).values({
      sessionId,
      questionId,
      audioUrl: data.audioUrl ?? null,
      audioFilePath: data.audioFilePath ?? null,
      transcription: data.transcription ?? null,
      transcriptFilePath: data.transcriptFilePath ?? null,
      isCompleted: data.isCompleted ?? false,
    });

    const insertId = result[0].insertId;
    const response = await db.select().from(responses).where(eq(responses.id, insertId)).limit(1);
    return response[0]!;
  }

  // Reports
  async getReport(sessionId: number): Promise<Report | undefined> {
    const result = await db.select().from(reports).where(eq(reports.sessionId, sessionId)).limit(1);
    return result[0];
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const result = await db.insert(reports).values({
      sessionId: insertReport.sessionId,
      summary: insertReport.summary,
      designPreferences: insertReport.designPreferences ?? null,
      functionalNeeds: insertReport.functionalNeeds ?? null,
      lifestyleElements: insertReport.lifestyleElements ?? null,
      additionalNotes: insertReport.additionalNotes ?? null,
      jsonFilePath: insertReport.jsonFilePath ?? null,
      pdfFilePath: insertReport.pdfFilePath ?? null,
    });

    const insertId = result[0].insertId;
    const report = await db.select().from(reports).where(eq(reports.id, insertId)).limit(1);
    return report[0]!;
  }

  // Questions
  async getQuestions(): Promise<Question[]> {
    return db.select().from(questions).orderBy(asc(questions.sortOrder));
  }

  async getActiveQuestions(): Promise<Question[]> {
    return db.select().from(questions)
      .where(eq(questions.isActive, true))
      .orderBy(asc(questions.sortOrder));
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const result = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
    return result[0];
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    // Get max sort order
    const allQuestions = await this.getQuestions();
    const maxSortOrder = allQuestions.length > 0
      ? Math.max(...allQuestions.map(q => q.sortOrder))
      : 0;

    const result = await db.insert(questions).values({
      category: insertQuestion.category,
      title: insertQuestion.title,
      question: insertQuestion.question,
      helpText: insertQuestion.helpText ?? null,
      sortOrder: insertQuestion.sortOrder ?? maxSortOrder + 1,
      isActive: insertQuestion.isActive ?? true,
    });

    const insertId = result[0].insertId;
    const question = await db.select().from(questions).where(eq(questions.id, insertId)).limit(1);
    return question[0]!;
  }

  async updateQuestion(id: number, updates: Partial<InsertQuestion>): Promise<Question | undefined> {
    const existing = await this.getQuestion(id);
    if (!existing) return undefined;

    await db.update(questions).set({
      category: updates.category ?? existing.category,
      title: updates.title ?? existing.title,
      question: updates.question ?? existing.question,
      helpText: updates.helpText !== undefined ? updates.helpText : existing.helpText,
      sortOrder: updates.sortOrder ?? existing.sortOrder,
      isActive: updates.isActive ?? existing.isActive,
    }).where(eq(questions.id, id));

    return this.getQuestion(id);
  }

  async deleteQuestion(id: number): Promise<boolean> {
    const existing = await this.getQuestion(id);
    if (!existing) return false;

    await db.delete(questions).where(eq(questions.id, id));
    return true;
  }

  async reorderQuestions(orderedIds: number[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(questions)
        .set({ sortOrder: i + 1 })
        .where(eq(questions.id, orderedIds[i]));
    }
  }

  // Site Content
  async getAllContent(): Promise<SiteContent[]> {
    return db.select().from(siteContent);
  }

  async getContent(key: string): Promise<SiteContent | undefined> {
    const result = await db.select().from(siteContent).where(eq(siteContent.key, key)).limit(1);
    return result[0];
  }

  async updateContent(key: string, value: string): Promise<SiteContent | undefined> {
    const existing = await this.getContent(key);
    if (!existing) return undefined;

    await db.update(siteContent)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteContent.key, key));

    return this.getContent(key);
  }
}

// Export MySQL storage instance
export const storage = new MySQLStorage();

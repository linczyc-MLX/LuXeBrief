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
  type LivingResponse,
  type InsertLivingResponse,
  defaultQuestions,
  defaultSiteContent,
  users,
  sessions,
  responses,
  reports,
  questions,
  siteContent,
  livingResponses
} from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, and, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Sessions
  getSession(id: number): Promise<Session | undefined>;
  getSessionsByEmail(email: string): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined>;

  // Responses (Lifestyle - audio-based)
  getResponsesBySession(sessionId: number): Promise<Response[]>;
  getResponse(sessionId: number, questionId: number): Promise<Response | undefined>;
  createOrUpdateResponse(sessionId: number, questionId: number, data: Partial<InsertResponse>): Promise<Response>;

  // Living Responses (form-based)
  getLivingResponsesBySession(sessionId: number): Promise<LivingResponse[]>;
  getLivingResponse(sessionId: number, stepId: string): Promise<LivingResponse | undefined>;
  createOrUpdateLivingResponse(sessionId: number, stepId: string, data: Partial<InsertLivingResponse>): Promise<LivingResponse>;

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

  // Initialize
  initialize(): Promise<void>;
}

// MySQL Storage Implementation
export class MySQLStorage implements IStorage {
  private db: any;
  private initialized = false;

  constructor() {
    // Lazy load db to avoid startup failures
  }

  private async getDb() {
    if (!this.db) {
      const { db } = await import("./db");
      this.db = db;
    }
    return this.db;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const db = await this.getDb();

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
    const db = await this.getDb();
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = await this.getDb();
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = await this.getDb();
    const id = randomUUID();
    await db.insert(users).values({ ...insertUser, id });
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0]!;
  }

  // Sessions
  async getSession(id: number): Promise<Session | undefined> {
    const db = await this.getDb();
    const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
    return result[0];
  }

  async getSessionsByEmail(email: string): Promise<Session[]> {
    const db = await this.getDb();
    const result = await db.select().from(sessions).where(eq(sessions.clientEmail, email));
    // Sort by ID descending to get most recent first
    return result.sort((a: Session, b: Session) => b.id - a.id);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const db = await this.getDb();
    // Use provided accessToken or generate a new one
    const accessToken = insertSession.accessToken || randomUUID();
    const result = await db.insert(sessions).values({
      clientName: insertSession.clientName,
      projectName: insertSession.projectName ?? null,
      accessToken,
      folderPath: insertSession.folderPath ?? null,
      status: insertSession.status || "in_progress",
      currentQuestionIndex: insertSession.currentQuestionIndex ?? 0,
      // N4S integration fields
      n4sProjectId: insertSession.n4sProjectId ?? null,
      n4sPrincipalType: insertSession.n4sPrincipalType ?? null,
      clientEmail: insertSession.clientEmail ?? null,
      subdomain: insertSession.subdomain ?? null,
      invitationSentAt: insertSession.invitationSentAt ?? null,
    });

    const insertId = result[0].insertId;
    const session = await db.select().from(sessions).where(eq(sessions.id, insertId)).limit(1);
    return session[0]!;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    const db = await this.getDb();
    const existing = await this.getSession(id);
    if (!existing) return undefined;

    await db.update(sessions).set(updates).where(eq(sessions.id, id));
    return this.getSession(id);
  }

  // Responses
  async getResponsesBySession(sessionId: number): Promise<Response[]> {
    const db = await this.getDb();
    return db.select().from(responses).where(eq(responses.sessionId, sessionId));
  }

  async getResponse(sessionId: number, questionId: number): Promise<Response | undefined> {
    const db = await this.getDb();
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
    const db = await this.getDb();
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

  // Living Responses (form-based questionnaire)
  async getLivingResponsesBySession(sessionId: number): Promise<LivingResponse[]> {
    const db = await this.getDb();
    return db.select().from(livingResponses).where(eq(livingResponses.sessionId, sessionId));
  }

  async getLivingResponse(sessionId: number, stepId: string): Promise<LivingResponse | undefined> {
    const db = await this.getDb();
    const result = await db.select().from(livingResponses)
      .where(and(eq(livingResponses.sessionId, sessionId), eq(livingResponses.stepId, stepId)))
      .limit(1);
    return result[0];
  }

  async createOrUpdateLivingResponse(
    sessionId: number,
    stepId: string,
    data: Partial<InsertLivingResponse>
  ): Promise<LivingResponse> {
    const db = await this.getDb();
    const existing = await this.getLivingResponse(sessionId, stepId);

    if (existing) {
      await db.update(livingResponses).set({
        data: data.data !== undefined ? data.data : existing.data,
        isCompleted: data.isCompleted !== undefined ? data.isCompleted : existing.isCompleted,
      }).where(eq(livingResponses.id, existing.id));

      return (await this.getLivingResponse(sessionId, stepId))!;
    }

    const result = await db.insert(livingResponses).values({
      sessionId,
      stepId,
      data: data.data || "{}",
      isCompleted: data.isCompleted ?? false,
    });

    const insertId = result[0].insertId;
    const response = await db.select().from(livingResponses).where(eq(livingResponses.id, insertId)).limit(1);
    return response[0]!;
  }

  // Reports
  async getReport(sessionId: number): Promise<Report | undefined> {
    const db = await this.getDb();
    const result = await db.select().from(reports).where(eq(reports.sessionId, sessionId)).limit(1);
    return result[0];
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const db = await this.getDb();
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
    const db = await this.getDb();
    return db.select().from(questions).orderBy(asc(questions.sortOrder));
  }

  async getActiveQuestions(): Promise<Question[]> {
    const db = await this.getDb();
    return db.select().from(questions)
      .where(eq(questions.isActive, true))
      .orderBy(asc(questions.sortOrder));
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    const db = await this.getDb();
    const result = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
    return result[0];
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const db = await this.getDb();
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
    const db = await this.getDb();
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
    const db = await this.getDb();
    const existing = await this.getQuestion(id);
    if (!existing) return false;

    await db.delete(questions).where(eq(questions.id, id));
    return true;
  }

  async reorderQuestions(orderedIds: number[]): Promise<void> {
    const db = await this.getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(questions)
        .set({ sortOrder: i + 1 })
        .where(eq(questions.id, orderedIds[i]));
    }
  }

  // Site Content
  async getAllContent(): Promise<SiteContent[]> {
    const db = await this.getDb();
    return db.select().from(siteContent);
  }

  async getContent(key: string): Promise<SiteContent | undefined> {
    const db = await this.getDb();
    const result = await db.select().from(siteContent).where(eq(siteContent.key, key)).limit(1);
    return result[0];
  }

  async updateContent(key: string, value: string): Promise<SiteContent | undefined> {
    const db = await this.getDb();
    const existing = await this.getContent(key);
    if (!existing) return undefined;

    await db.update(siteContent)
      .set({ value, updatedAt: new Date() })
      .where(eq(siteContent.key, key));

    return this.getContent(key);
  }
}

// In-Memory Storage (fallback)
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<number, Session>;
  private responses: Map<string, Response>;
  private livingResponses: Map<string, LivingResponse>;
  private reports: Map<number, Report>;
  private questions: Map<number, Question>;
  private content: Map<string, SiteContent>;
  private nextSessionId: number;
  private nextResponseId: number;
  private nextLivingResponseId: number;
  private nextReportId: number;
  private nextQuestionId: number;
  private nextContentId: number;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.responses = new Map();
    this.livingResponses = new Map();
    this.reports = new Map();
    this.questions = new Map();
    this.content = new Map();
    this.nextSessionId = 1;
    this.nextResponseId = 1;
    this.nextLivingResponseId = 1;
    this.nextReportId = 1;
    this.nextQuestionId = 1;
    this.nextContentId = 1;
  }

  async initialize(): Promise<void> {
    // Seed defaults
    this.seedDefaultQuestions();
    this.seedDefaultContent();
    console.log("MemStorage initialized (WARNING: Data will not persist across restarts!)");
  }

  private seedDefaultContent() {
    for (const dc of defaultSiteContent) {
      const id = this.nextContentId++;
      const content: SiteContent = {
        id,
        key: dc.key,
        value: dc.value,
        label: dc.label,
        section: dc.section,
        updatedAt: new Date(),
      };
      this.content.set(dc.key, content);
    }
  }

  private seedDefaultQuestions() {
    for (const dq of defaultQuestions) {
      const id = this.nextQuestionId++;
      const question: Question = {
        id,
        category: dq.category,
        title: dq.title,
        question: dq.question,
        helpText: dq.helpText ?? null,
        sortOrder: dq.sortOrder,
        isActive: true,
        createdAt: new Date(),
      };
      this.questions.set(id, question);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionsByEmail(email: string): Promise<Session[]> {
    const allSessions = Array.from(this.sessions.values());
    // Filter by email and sort by ID descending (most recent first)
    return allSessions
      .filter(s => (s as any).clientEmail === email)
      .sort((a, b) => b.id - a.id);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.nextSessionId++;
    const session: Session = {
      id,
      clientName: insertSession.clientName,
      projectName: insertSession.projectName ?? null,
      accessToken: randomUUID(),
      folderPath: insertSession.folderPath ?? null,
      status: insertSession.status || "in_progress",
      currentQuestionIndex: insertSession.currentQuestionIndex ?? 0,
      createdAt: new Date(),
      completedAt: null,
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  async getResponsesBySession(sessionId: number): Promise<Response[]> {
    return Array.from(this.responses.values()).filter(r => r.sessionId === sessionId);
  }

  async getResponse(sessionId: number, questionId: number): Promise<Response | undefined> {
    return this.responses.get(`${sessionId}-${questionId}`);
  }

  async createOrUpdateResponse(sessionId: number, questionId: number, data: Partial<InsertResponse>): Promise<Response> {
    const key = `${sessionId}-${questionId}`;
    const existing = this.responses.get(key);

    if (existing) {
      const updated: Response = {
        ...existing,
        audioUrl: data.audioUrl !== undefined ? data.audioUrl : existing.audioUrl,
        audioFilePath: data.audioFilePath !== undefined ? data.audioFilePath : existing.audioFilePath,
        transcription: data.transcription !== undefined ? data.transcription : existing.transcription,
        transcriptFilePath: data.transcriptFilePath !== undefined ? data.transcriptFilePath : existing.transcriptFilePath,
        isCompleted: data.isCompleted !== undefined ? data.isCompleted : existing.isCompleted,
      };
      this.responses.set(key, updated);
      return updated;
    }

    const response: Response = {
      id: this.nextResponseId++,
      sessionId,
      questionId,
      audioUrl: data.audioUrl ?? null,
      audioFilePath: data.audioFilePath ?? null,
      transcription: data.transcription ?? null,
      transcriptFilePath: data.transcriptFilePath ?? null,
      isCompleted: data.isCompleted ?? false,
      createdAt: new Date(),
    };
    this.responses.set(key, response);
    return response;
  }

  // Living Responses (form-based questionnaire)
  async getLivingResponsesBySession(sessionId: number): Promise<LivingResponse[]> {
    return Array.from(this.livingResponses.values()).filter(r => r.sessionId === sessionId);
  }

  async getLivingResponse(sessionId: number, stepId: string): Promise<LivingResponse | undefined> {
    return this.livingResponses.get(`${sessionId}-${stepId}`);
  }

  async createOrUpdateLivingResponse(
    sessionId: number,
    stepId: string,
    data: Partial<InsertLivingResponse>
  ): Promise<LivingResponse> {
    const key = `${sessionId}-${stepId}`;
    const existing = this.livingResponses.get(key);

    if (existing) {
      const updated: LivingResponse = {
        ...existing,
        data: data.data !== undefined ? data.data : existing.data,
        isCompleted: data.isCompleted !== undefined ? data.isCompleted : existing.isCompleted,
        updatedAt: new Date(),
      };
      this.livingResponses.set(key, updated);
      return updated;
    }

    const response: LivingResponse = {
      id: this.nextLivingResponseId++,
      sessionId,
      stepId,
      data: data.data || "{}",
      isCompleted: data.isCompleted ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.livingResponses.set(key, response);
    return response;
  }

  async getReport(sessionId: number): Promise<Report | undefined> {
    return this.reports.get(sessionId);
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const id = this.nextReportId++;
    const report: Report = {
      id,
      sessionId: insertReport.sessionId,
      summary: insertReport.summary,
      designPreferences: insertReport.designPreferences ?? null,
      functionalNeeds: insertReport.functionalNeeds ?? null,
      lifestyleElements: insertReport.lifestyleElements ?? null,
      additionalNotes: insertReport.additionalNotes ?? null,
      jsonFilePath: insertReport.jsonFilePath ?? null,
      pdfFilePath: insertReport.pdfFilePath ?? null,
      createdAt: new Date(),
    };
    this.reports.set(insertReport.sessionId, report);
    return report;
  }

  async getQuestions(): Promise<Question[]> {
    return Array.from(this.questions.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getActiveQuestions(): Promise<Question[]> {
    return Array.from(this.questions.values())
      .filter(q => q.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.nextQuestionId++;
    const maxSortOrder = Math.max(0, ...Array.from(this.questions.values()).map(q => q.sortOrder));
    const question: Question = {
      id,
      category: insertQuestion.category,
      title: insertQuestion.title,
      question: insertQuestion.question,
      helpText: insertQuestion.helpText ?? null,
      sortOrder: insertQuestion.sortOrder ?? maxSortOrder + 1,
      isActive: insertQuestion.isActive ?? true,
      createdAt: new Date(),
    };
    this.questions.set(id, question);
    return question;
  }

  async updateQuestion(id: number, updates: Partial<InsertQuestion>): Promise<Question | undefined> {
    const existing = this.questions.get(id);
    if (!existing) return undefined;
    const updated: Question = {
      ...existing,
      category: updates.category ?? existing.category,
      title: updates.title ?? existing.title,
      question: updates.question ?? existing.question,
      helpText: updates.helpText !== undefined ? updates.helpText : existing.helpText,
      sortOrder: updates.sortOrder ?? existing.sortOrder,
      isActive: updates.isActive ?? existing.isActive,
    };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: number): Promise<boolean> {
    return this.questions.delete(id);
  }

  async reorderQuestions(orderedIds: number[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const question = this.questions.get(id);
      if (question) {
        question.sortOrder = index + 1;
        this.questions.set(id, question);
      }
    });
  }

  async getAllContent(): Promise<SiteContent[]> {
    return Array.from(this.content.values());
  }

  async getContent(key: string): Promise<SiteContent | undefined> {
    return this.content.get(key);
  }

  async updateContent(key: string, value: string): Promise<SiteContent | undefined> {
    const existing = this.content.get(key);
    if (!existing) return undefined;
    const updated: SiteContent = { ...existing, value, updatedAt: new Date() };
    this.content.set(key, updated);
    return updated;
  }
}

// Storage factory - tries MySQL first, falls back to MemStorage
async function createStorage(): Promise<IStorage> {
  if (process.env.DATABASE_URL) {
    try {
      console.log("Attempting to connect to MySQL database...");
      const mysqlStorage = new MySQLStorage();
      await mysqlStorage.initialize();
      console.log("Successfully connected to MySQL database.");
      return mysqlStorage;
    } catch (error) {
      console.error("MySQL connection failed, falling back to MemStorage:", error);
    }
  } else {
    console.log("No DATABASE_URL configured.");
  }

  console.log("Using MemStorage (data will NOT persist!)");
  const memStorage = new MemStorage();
  await memStorage.initialize();
  return memStorage;
}

// Export a promise that resolves to the storage instance
let storageInstance: IStorage | null = null;
let storagePromise: Promise<IStorage> | null = null;

export function getStorage(): Promise<IStorage> {
  if (storageInstance) {
    return Promise.resolve(storageInstance);
  }
  if (!storagePromise) {
    storagePromise = createStorage().then(s => {
      storageInstance = s;
      return s;
    });
  }
  return storagePromise;
}

// For backward compatibility - synchronous export (will be initialized later)
// This is a proxy that defers operations until storage is ready
class StorageProxy implements IStorage {
  private getStorageSync(): IStorage {
    if (!storageInstance) {
      throw new Error("Storage not initialized. Call getStorage() first.");
    }
    return storageInstance;
  }

  async initialize(): Promise<void> {
    const s = await getStorage();
    // Already initialized in getStorage
  }

  getUser(id: string) { return getStorage().then(s => s.getUser(id)); }
  getUserByUsername(username: string) { return getStorage().then(s => s.getUserByUsername(username)); }
  createUser(user: InsertUser) { return getStorage().then(s => s.createUser(user)); }
  getSession(id: number) { return getStorage().then(s => s.getSession(id)); }
  getSessionsByEmail(email: string) { return getStorage().then(s => s.getSessionsByEmail(email)); }
  createSession(session: InsertSession) { return getStorage().then(s => s.createSession(session)); }
  updateSession(id: number, updates: Partial<Session>) { return getStorage().then(s => s.updateSession(id, updates)); }
  getResponsesBySession(sessionId: number) { return getStorage().then(s => s.getResponsesBySession(sessionId)); }
  getResponse(sessionId: number, questionId: number) { return getStorage().then(s => s.getResponse(sessionId, questionId)); }
  createOrUpdateResponse(sessionId: number, questionId: number, data: Partial<InsertResponse>) { return getStorage().then(s => s.createOrUpdateResponse(sessionId, questionId, data)); }
  getLivingResponsesBySession(sessionId: number) { return getStorage().then(s => s.getLivingResponsesBySession(sessionId)); }
  getLivingResponse(sessionId: number, stepId: string) { return getStorage().then(s => s.getLivingResponse(sessionId, stepId)); }
  createOrUpdateLivingResponse(sessionId: number, stepId: string, data: Partial<InsertLivingResponse>) { return getStorage().then(s => s.createOrUpdateLivingResponse(sessionId, stepId, data)); }
  getReport(sessionId: number) { return getStorage().then(s => s.getReport(sessionId)); }
  createReport(report: InsertReport) { return getStorage().then(s => s.createReport(report)); }
  getQuestions() { return getStorage().then(s => s.getQuestions()); }
  getActiveQuestions() { return getStorage().then(s => s.getActiveQuestions()); }
  getQuestion(id: number) { return getStorage().then(s => s.getQuestion(id)); }
  createQuestion(question: InsertQuestion) { return getStorage().then(s => s.createQuestion(question)); }
  updateQuestion(id: number, updates: Partial<InsertQuestion>) { return getStorage().then(s => s.updateQuestion(id, updates)); }
  deleteQuestion(id: number) { return getStorage().then(s => s.deleteQuestion(id)); }
  reorderQuestions(orderedIds: number[]) { return getStorage().then(s => s.reorderQuestions(orderedIds)); }
  getAllContent() { return getStorage().then(s => s.getAllContent()); }
  getContent(key: string) { return getStorage().then(s => s.getContent(key)); }
  updateContent(key: string, value: string) { return getStorage().then(s => s.updateContent(key, value)); }
}

export const storage = new StorageProxy();

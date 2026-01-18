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
  defaultSiteContent
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<number, Session>;
  private responses: Map<string, Response>; // key: `${sessionId}-${questionId}`
  private reports: Map<number, Report>; // key: sessionId
  private questions: Map<number, Question>; // key: question id
  private content: Map<string, SiteContent>; // key: content key
  private nextSessionId: number;
  private nextResponseId: number;
  private nextReportId: number;
  private nextQuestionId: number;
  private nextContentId: number;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.responses = new Map();
    this.reports = new Map();
    this.questions = new Map();
    this.content = new Map();
    this.nextSessionId = 1;
    this.nextResponseId = 1;
    this.nextReportId = 1;
    this.nextQuestionId = 1;
    this.nextContentId = 1;
    
    // Seed defaults
    this.seedDefaultQuestions();
    this.seedDefaultContent();
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

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Sessions
  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.nextSessionId++;
    const session: Session = {
      id,
      clientName: insertSession.clientName,
      accessToken: randomUUID(), // Generate unique access token for secure file access
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

  // Responses
  async getResponsesBySession(sessionId: number): Promise<Response[]> {
    return Array.from(this.responses.values()).filter(
      (r) => r.sessionId === sessionId
    );
  }

  async getResponse(sessionId: number, questionId: number): Promise<Response | undefined> {
    return this.responses.get(`${sessionId}-${questionId}`);
  }

  async createOrUpdateResponse(
    sessionId: number, 
    questionId: number, 
    data: Partial<InsertResponse>
  ): Promise<Response> {
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

  // Reports
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
  
  // Questions
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
  
  // Site Content
  async getAllContent(): Promise<SiteContent[]> {
    return Array.from(this.content.values());
  }
  
  async getContent(key: string): Promise<SiteContent | undefined> {
    return this.content.get(key);
  }
  
  async updateContent(key: string, value: string): Promise<SiteContent | undefined> {
    const existing = this.content.get(key);
    if (!existing) return undefined;
    
    const updated: SiteContent = {
      ...existing,
      value,
      updatedAt: new Date(),
    };
    this.content.set(key, updated);
    return updated;
  }
}

export const storage = new MemStorage();

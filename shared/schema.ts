import { sql } from "drizzle-orm";
import { mysqlTable, text, varchar, int, timestamp, boolean } from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (kept for compatibility)
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`(UUID())`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Briefing Sessions
export const sessions = mysqlTable("sessions", {
  id: int("id").primaryKey().autoincrement(),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  projectName: varchar("project_name", { length: 255 }), // Optional project name for reports
  sessionType: varchar("session_type", { length: 20 }).notNull().default("lifestyle"), // 'lifestyle' (audio) or 'living' (form)
  accessToken: varchar("access_token", { length: 255 }), // Random token for secure file access
  folderPath: varchar("folder_path", { length: 500 }), // Path to client data folder
  status: varchar("status", { length: 50 }).notNull().default("in_progress"), // in_progress, completed
  currentQuestionIndex: int("current_question_index").notNull().default(0), // For lifestyle: question index, for living: step index
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  completedAt: timestamp("completed_at"),
  // N4S Integration fields
  n4sProjectId: varchar("n4s_project_id", { length: 100 }), // Link to N4S project
  n4sPrincipalType: varchar("n4s_principal_type", { length: 20 }), // 'principal' or 'secondary'
  clientEmail: varchar("client_email", { length: 255 }), // Client email for notifications
  subdomain: varchar("subdomain", { length: 100 }), // e.g., 'pthornwood' for pthornwood.luxebrief.not-4.sale
  invitationSentAt: timestamp("invitation_sent_at"), // When invitation email was sent
});

// Session type constants
export type SessionType = "lifestyle" | "living";
export const SESSION_TYPES = {
  LIFESTYLE: "lifestyle" as const, // Audio-based questionnaire
  LIVING: "living" as const,       // Form-based questionnaire
};

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

// Question Responses
export const responses = mysqlTable("responses", {
  id: int("id").primaryKey().autoincrement(),
  sessionId: int("session_id").notNull(),
  questionId: int("question_id").notNull(),
  audioUrl: varchar("audio_url", { length: 500 }), // Optional stored audio
  audioFilePath: varchar("audio_file_path", { length: 500 }), // File path on disk
  transcription: text("transcription"),
  transcriptFilePath: varchar("transcript_file_path", { length: 500 }), // File path on disk
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertResponseSchema = createInsertSchema(responses).omit({
  id: true,
  createdAt: true,
});

export type Response = typeof responses.$inferSelect;
export type InsertResponse = z.infer<typeof insertResponseSchema>;

// Report Summaries
export const reports = mysqlTable("reports", {
  id: int("id").primaryKey().autoincrement(),
  sessionId: int("session_id").notNull().unique(),
  summary: text("summary").notNull(),
  designPreferences: text("design_preferences"),
  functionalNeeds: text("functional_needs"),
  lifestyleElements: text("lifestyle_elements"),
  additionalNotes: text("additional_notes"),
  jsonFilePath: varchar("json_file_path", { length: 500 }), // Path to summary.json on disk
  pdfFilePath: varchar("pdf_file_path", { length: 500 }), // Path to report.pdf on disk
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

// Questions table (stored in DB, editable via admin)
export const questions = mysqlTable("questions", {
  id: int("id").primaryKey().autoincrement(),
  category: varchar("category", { length: 50 }).notNull(), // vision, design, functional, lifestyle, emotional
  title: varchar("title", { length: 255 }).notNull(),
  question: text("question").notNull(),
  helpText: text("help_text"),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
  createdAt: true,
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

// Legacy Question interface for seeding defaults
export interface DefaultQuestion {
  category: "vision" | "design" | "functional" | "lifestyle" | "emotional";
  title: string;
  question: string;
  helpText?: string;
  sortOrder: number;
}

export const defaultQuestions: DefaultQuestion[] = [
  // Vision & Aspirations
  {
    category: "vision",
    title: "Your Vision",
    question: "Describe your ultimate vision for this residence. What feelings do you want to experience when you walk through the door?",
    helpText: "Think about the emotions and atmosphere you want your home to evoke.",
    sortOrder: 1
  },
  {
    category: "vision",
    title: "Inspiration",
    question: "What places, experiences, or architectural references inspire you? Have you seen homes that moved you?",
    helpText: "Consider travels, hotels, or residences that left a lasting impression.",
    sortOrder: 2
  },
  // Design Preferences
  {
    category: "design",
    title: "Architectural Style",
    question: "What architectural styles resonate with you? Do you prefer modern minimalism, classical elegance, or something entirely unique?",
    helpText: "Describe any specific design elements or aesthetics you're drawn to.",
    sortOrder: 3
  },
  {
    category: "design",
    title: "Materials & Finishes",
    question: "What materials speak to you? Consider stone, wood, metal, glass, or textiles that you find particularly appealing.",
    helpText: "Think about textures and materials you love to touch and see.",
    sortOrder: 4
  },
  {
    category: "design",
    title: "Color Palette",
    question: "Describe your ideal color palette. Do you gravitate toward warm earth tones, cool neutrals, or bold statements?",
    helpText: "Consider the mood different colors create in a space.",
    sortOrder: 5
  },
  // Functional Needs
  {
    category: "functional",
    title: "Spaces & Layout",
    question: "What spaces are essential to your daily life? How do you envision the flow between public and private areas?",
    helpText: "Think about entertaining, working, relaxing, and family activities.",
    sortOrder: 6
  },
  {
    category: "functional",
    title: "Special Requirements",
    question: "Are there any special requirements for accessibility, security, technology, or sustainability?",
    helpText: "Consider smart home features, energy efficiency, or wellness amenities.",
    sortOrder: 7
  },
  // Lifestyle Elements
  {
    category: "lifestyle",
    title: "Daily Rituals",
    question: "Walk us through your ideal day at home. What rituals are important to you?",
    helpText: "From morning coffee to evening relaxation, describe your routines.",
    sortOrder: 8
  },
  {
    category: "lifestyle",
    title: "Entertainment & Guests",
    question: "How do you envision entertaining in this home? What scale and style of gatherings do you host?",
    helpText: "Consider intimate dinners, large celebrations, or extended family stays.",
    sortOrder: 9
  },
  // Emotional & Personal
  {
    category: "emotional",
    title: "Personal Sanctuary",
    question: "Which spaces need to feel like absolute sanctuaries? What makes a space feel sacred to you?",
    helpText: "Think about privacy, quiet, and personal restoration.",
    sortOrder: 10
  },
  {
    category: "emotional",
    title: "Legacy & Meaning",
    question: "What story do you want this home to tell? How should it reflect your journey and values?",
    helpText: "Consider what you want this residence to mean for generations.",
    sortOrder: 11
  },
  {
    category: "emotional",
    title: "Final Thoughts",
    question: "Is there anything else we should know? Any dreams, concerns, or specific details that are important to you?",
    helpText: "Share anything that hasn't been covered in our conversation.",
    sortOrder: 12
  }
];

// Categories for grouping
export type QuestionCategory = "vision" | "design" | "functional" | "lifestyle" | "emotional";

export const categoryLabels: Record<QuestionCategory, string> = {
  vision: "Vision & Aspirations",
  design: "Design Preferences",
  functional: "Functional Requirements",
  lifestyle: "Lifestyle & Entertainment",
  emotional: "Personal & Emotional"
};

// Site Content table for editable text elements
export const siteContent = mysqlTable("site_content", {
  id: int("id").primaryKey().autoincrement(),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  section: varchar("section", { length: 100 }).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export const insertSiteContentSchema = createInsertSchema(siteContent).omit({
  id: true,
  updatedAt: true,
});

export type SiteContent = typeof siteContent.$inferSelect;
export type InsertSiteContent = z.infer<typeof insertSiteContentSchema>;

// Default site content values
export const defaultSiteContent: Omit<SiteContent, "id" | "updatedAt">[] = [
  { key: "home.headline", value: "Design Your Dream Residence", label: "Main Headline", section: "Home Page" },
  { key: "home.subtitle", value: "A guided experience for articulating your vision for ultra-luxury living", label: "Subtitle", section: "Home Page" },
  { key: "home.cta_button", value: "Begin Your Design Journey", label: "Start Button Text", section: "Home Page" },
  { key: "home.features.private_title", value: "Private & Confidential", label: "Feature 1 Title", section: "Home Page" },
  { key: "home.features.private_desc", value: "Your responses are securely recorded and never shared", label: "Feature 1 Description", section: "Home Page" },
  { key: "home.features.ai_title", value: "AI-Powered Insights", label: "Feature 2 Title", section: "Home Page" },
  { key: "home.features.ai_desc", value: "Advanced transcription transforms your vision into actionable insights", label: "Feature 2 Description", section: "Home Page" },
  { key: "home.features.export_title", value: "Professional Export", label: "Feature 3 Title", section: "Home Page" },
  { key: "home.features.export_desc", value: "Receive a beautifully crafted PDF summary of your design brief", label: "Feature 3 Description", section: "Home Page" },
  { key: "briefing.intro_title", value: "Let's Begin", label: "Intro Title", section: "Briefing" },
  { key: "briefing.intro_subtitle", value: "Take your time with each question. There are no right or wrong answers.", label: "Intro Subtitle", section: "Briefing" },
  { key: "report.success_title", value: "Your Design Brief is Complete", label: "Success Title", section: "Report" },
  { key: "report.success_subtitle", value: "We've analyzed your responses and created a comprehensive summary of your design vision.", label: "Success Subtitle", section: "Report" },
];

// ===== LuXeBrief Living: Form-based questionnaire steps =====

// Living responses table (stores structured form data per step)
export const livingResponses = mysqlTable("living_responses", {
  id: int("id").primaryKey().autoincrement(),
  sessionId: int("session_id").notNull(),
  stepId: varchar("step_id", { length: 50 }).notNull(), // e.g., 'work', 'hobbies', 'interior'
  data: text("data").notNull(), // JSON stringified form data
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export const insertLivingResponseSchema = createInsertSchema(livingResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LivingResponse = typeof livingResponses.$inferSelect;
export type InsertLivingResponse = z.infer<typeof insertLivingResponseSchema>;

// Living step definitions
export interface LivingStep {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  sortOrder: number;
}

export const livingSteps: LivingStep[] = [
  {
    id: "work",
    title: "Work & Productivity",
    description: "Tell us about your work-from-home needs and office requirements.",
    icon: "Briefcase",
    sortOrder: 1,
  },
  {
    id: "hobbies",
    title: "Hobbies & Activities",
    description: "What activities require dedicated space in your home?",
    icon: "Palette",
    sortOrder: 2,
  },
  {
    id: "entertaining",
    title: "Entertaining",
    description: "How do you envision hosting guests in your new residence?",
    icon: "Users",
    sortOrder: 3,
  },
  {
    id: "wellness",
    title: "Wellness & Privacy",
    description: "Your priorities for health, wellbeing, and personal space.",
    icon: "Heart",
    sortOrder: 4,
  },
  {
    id: "interior",
    title: "Interior Spaces",
    description: "Select the interior spaces essential to your residence.",
    icon: "Home",
    sortOrder: 5,
  },
  {
    id: "exterior",
    title: "Exterior Amenities",
    description: "Define your outdoor living and recreational requirements.",
    icon: "Trees",
    sortOrder: 6,
  },
  {
    id: "final",
    title: "Garage, Technology & Details",
    description: "Complete your program with final specifications.",
    icon: "Settings",
    sortOrder: 7,
  },
];

// Living step data interfaces for type safety
export interface LivingStepData {
  work?: {
    workFromHome?: string; // 'never' | 'sometimes' | 'often' | 'always'
    wfhPeopleCount?: number;
    separateOfficesRequired?: boolean;
    officeRequirements?: string;
  };
  hobbies?: {
    hobbies?: string[]; // Array of hobby values
    hobbyDetails?: string;
    lateNightMediaUse?: boolean;
  };
  entertaining?: {
    entertainingFrequency?: string;
    entertainingStyle?: string;
    typicalGuestCount?: string;
  };
  wellness?: {
    wellnessPriorities?: string[];
    privacyLevelRequired?: number; // 1-5
    noiseSensitivity?: number; // 1-5
    indoorOutdoorLiving?: number; // 1-5
  };
  interior?: {
    mustHaveSpaces?: string[];
    niceToHaveSpaces?: string[];
    wantsSeparateFamilyRoom?: boolean;
    wantsSecondFormalLiving?: boolean;
    wantsBar?: boolean;
    wantsBunkRoom?: boolean;
    wantsBreakfastNook?: boolean;
  };
  exterior?: {
    mustHavePoolWater?: string[];
    wouldLikePoolWater?: string[];
    mustHaveSport?: string[];
    wouldLikeSport?: string[];
    mustHaveOutdoorLiving?: string[];
    wouldLikeOutdoorLiving?: string[];
    mustHaveGarden?: string[];
    wouldLikeGarden?: string[];
    mustHaveStructures?: string[];
    wouldLikeStructures?: string[];
    mustHaveAccess?: string[];
    wouldLikeAccess?: string[];
  };
  final?: {
    garageSize?: string;
    garageFeatures?: string[];
    technologyRequirements?: string[];
    sustainabilityPriorities?: string[];
    viewPriorityRooms?: string[];
    privacyNoNeighbors?: string;
    privacyPerimeter?: string;
    minimumSetback?: string;
    minimumLotSize?: string;
    adjacencyRequirements?: string;
    currentSpacePainPoints?: string;
    dailyRoutinesSummary?: string;
  };
}

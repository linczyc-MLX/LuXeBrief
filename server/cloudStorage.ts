import * as fs from "fs/promises";
import * as path from "path";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Use local file storage for Railway deployment
// Files are stored in the 'data' directory
function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
  }
}

export class CloudStorageService {
  static getSessionFolderName(clientName: string, sessionId: number): string {
    const slug = slugify(clientName) || "anonymous";
    return `${slug}-${sessionId}`;
  }

  static getSessionPath(clientName: string, sessionId: number): string {
    const folderName = this.getSessionFolderName(clientName, sessionId);
    return path.join(getDataDir(), "briefings", folderName);
  }

  static async saveAudio(
    clientName: string,
    sessionId: number,
    questionId: number,
    audioBuffer: Buffer,
    format: string = "webm"
  ): Promise<string> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const audioDir = path.join(sessionPath, "audio");
    await ensureDir(audioDir);

    const filePath = path.join(audioDir, `question-${questionId}.${format}`);
    await fs.writeFile(filePath, audioBuffer);

    return filePath;
  }

  static async saveTranscript(
    clientName: string,
    sessionId: number,
    questionId: number,
    transcription: string,
    questionTitle?: string
  ): Promise<string> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const transcriptDir = path.join(sessionPath, "transcripts");
    await ensureDir(transcriptDir);

    const content = questionTitle
      ? `Question: ${questionTitle}\n\nResponse:\n${transcription}`
      : transcription;

    const filePath = path.join(transcriptDir, `question-${questionId}.txt`);
    await fs.writeFile(filePath, content, "utf-8");

    return filePath;
  }

  static async saveReport(
    clientName: string,
    sessionId: number,
    reportData: object
  ): Promise<{ jsonPath: string }> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const reportsDir = path.join(sessionPath, "reports");
    await ensureDir(reportsDir);

    const filePath = path.join(reportsDir, "summary.json");
    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2), "utf-8");

    return { jsonPath: filePath };
  }

  static async savePdf(
    clientName: string,
    sessionId: number,
    pdfBuffer: Buffer
  ): Promise<string> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const reportsDir = path.join(sessionPath, "reports");
    await ensureDir(reportsDir);

    const filePath = path.join(reportsDir, "report.pdf");
    await fs.writeFile(filePath, pdfBuffer);

    return filePath;
  }

  static async readFile(filePath: string): Promise<Buffer | null> {
    try {
      const buffer = await fs.readFile(filePath);
      return buffer;
    } catch (error) {
      console.error("Error reading file:", error);
      return null;
    }
  }

  static async readTranscript(
    clientName: string,
    sessionId: number,
    questionId: number
  ): Promise<string | null> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const filePath = path.join(sessionPath, "transcripts", `question-${questionId}.txt`);

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch (error) {
      return null;
    }
  }

  static async listSessionFiles(clientName: string, sessionId: number): Promise<string[]> {
    try {
      const sessionPath = this.getSessionPath(clientName, sessionId);
      const files: string[] = [];

      const walkDir = async (dir: string): Promise<void> => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              await walkDir(fullPath);
            } else {
              files.push(fullPath);
            }
          }
        } catch (error) {
          // Directory doesn't exist yet
        }
      };

      await walkDir(sessionPath);
      return files;
    } catch (error) {
      console.error("Error listing session files:", error);
      return [];
    }
  }
}

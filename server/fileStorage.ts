import fs from "fs";
import path from "path";
import { promisify } from "util";

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const renameAsync = promisify(fs.rename);
const existsAsync = promisify(fs.exists);
const readFileAsync = promisify(fs.readFile);

const DATA_ROOT = path.join(process.cwd(), "data");

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export class FileStorageService {
  private static async ensureDir(dirPath: string): Promise<void> {
    try {
      await mkdirAsync(dirPath, { recursive: true });
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
    }
  }

  static getSessionFolderName(clientName: string, sessionId: number): string {
    const slug = slugify(clientName) || "anonymous";
    return `${slug}-${sessionId}`;
  }

  static getSessionPath(clientName: string, sessionId: number): string {
    const folderName = this.getSessionFolderName(clientName, sessionId);
    return path.join(DATA_ROOT, folderName);
  }

  static async initSessionFolder(clientName: string, sessionId: number): Promise<string> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    await this.ensureDir(path.join(sessionPath, "audio"));
    await this.ensureDir(path.join(sessionPath, "transcripts"));
    await this.ensureDir(path.join(sessionPath, "reports"));
    return sessionPath;
  }

  static async saveAudio(
    clientName: string,
    sessionId: number,
    questionId: number,
    audioBuffer: Buffer,
    format: string = "wav"
  ): Promise<string> {
    const sessionPath = await this.initSessionFolder(clientName, sessionId);
    const audioDir = path.join(sessionPath, "audio");
    const fileName = `question-${questionId}.${format}`;
    const filePath = path.join(audioDir, fileName);
    const tempPath = `${filePath}.tmp`;
    
    await writeFileAsync(tempPath, audioBuffer);
    await renameAsync(tempPath, filePath);
    
    return filePath;
  }

  static async saveTranscript(
    clientName: string,
    sessionId: number,
    questionId: number,
    transcription: string,
    questionTitle?: string
  ): Promise<string> {
    const sessionPath = await this.initSessionFolder(clientName, sessionId);
    const transcriptDir = path.join(sessionPath, "transcripts");
    const fileName = `question-${questionId}.txt`;
    const filePath = path.join(transcriptDir, fileName);
    const tempPath = `${filePath}.tmp`;
    
    const content = questionTitle 
      ? `Question: ${questionTitle}\n\nResponse:\n${transcription}`
      : transcription;
    
    await writeFileAsync(tempPath, content, "utf-8");
    await renameAsync(tempPath, filePath);
    
    return filePath;
  }

  static async saveReport(
    clientName: string,
    sessionId: number,
    reportData: object
  ): Promise<{ jsonPath: string }> {
    const sessionPath = await this.initSessionFolder(clientName, sessionId);
    const reportDir = path.join(sessionPath, "reports");
    
    const jsonFileName = "summary.json";
    const jsonPath = path.join(reportDir, jsonFileName);
    const tempJsonPath = `${jsonPath}.tmp`;
    
    await writeFileAsync(tempJsonPath, JSON.stringify(reportData, null, 2), "utf-8");
    await renameAsync(tempJsonPath, jsonPath);
    
    return { jsonPath };
  }

  static async savePdf(
    clientName: string,
    sessionId: number,
    pdfBuffer: Buffer
  ): Promise<string> {
    const sessionPath = await this.initSessionFolder(clientName, sessionId);
    const reportDir = path.join(sessionPath, "reports");
    const pdfPath = path.join(reportDir, "report.pdf");
    const tempPath = `${pdfPath}.tmp`;
    
    await writeFileAsync(tempPath, pdfBuffer);
    await renameAsync(tempPath, pdfPath);
    
    return pdfPath;
  }

  static async getAudioPath(
    clientName: string,
    sessionId: number,
    questionId: number,
    format: string = "wav"
  ): Promise<string | null> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const filePath = path.join(sessionPath, "audio", `question-${questionId}.${format}`);
    
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  static async getTranscriptPath(
    clientName: string,
    sessionId: number,
    questionId: number
  ): Promise<string | null> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const filePath = path.join(sessionPath, "transcripts", `question-${questionId}.txt`);
    
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  static async readTranscript(
    clientName: string,
    sessionId: number,
    questionId: number
  ): Promise<string | null> {
    const filePath = await this.getTranscriptPath(clientName, sessionId, questionId);
    if (!filePath) return null;
    
    const content = await readFileAsync(filePath, "utf-8");
    return content;
  }

  static getDataRoot(): string {
    return DATA_ROOT;
  }
}

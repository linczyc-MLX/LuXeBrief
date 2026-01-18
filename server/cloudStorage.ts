import { objectStorageClient } from "./replit_integrations/object_storage";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function getBucketName(): string {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) {
    throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set. Set up object storage first.");
  }
  return bucketId;
}

function getPrivateDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR not set. Set up object storage first.");
  }
  // Extract just the path portion after the bucket name
  // Format: /<bucket-name>/<path>
  const parts = dir.split("/").filter(p => p);
  if (parts.length >= 2) {
    return parts.slice(1).join("/");
  }
  return ".private";
}

export class CloudStorageService {
  static getSessionFolderName(clientName: string, sessionId: number): string {
    const slug = slugify(clientName) || "anonymous";
    return `${slug}-${sessionId}`;
  }

  static getSessionPath(clientName: string, sessionId: number): string {
    const folderName = this.getSessionFolderName(clientName, sessionId);
    const privateDir = getPrivateDir();
    return `${privateDir}/briefings/${folderName}`;
  }

  static async saveAudio(
    clientName: string,
    sessionId: number,
    questionId: number,
    audioBuffer: Buffer,
    format: string = "webm"
  ): Promise<string> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const objectPath = `${sessionPath}/audio/question-${questionId}.${format}`;
    
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    await file.save(audioBuffer, {
      contentType: format === "webm" ? "audio/webm" : "audio/wav",
      resumable: false,
    });
    
    // Return the full object path for storage in database
    return `/${bucketName}/${objectPath}`;
  }

  static async saveTranscript(
    clientName: string,
    sessionId: number,
    questionId: number,
    transcription: string,
    questionTitle?: string
  ): Promise<string> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const objectPath = `${sessionPath}/transcripts/question-${questionId}.txt`;
    
    const content = questionTitle 
      ? `Question: ${questionTitle}\n\nResponse:\n${transcription}`
      : transcription;
    
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    await file.save(content, {
      contentType: "text/plain; charset=utf-8",
      resumable: false,
    });
    
    return `/${bucketName}/${objectPath}`;
  }

  static async saveReport(
    clientName: string,
    sessionId: number,
    reportData: object
  ): Promise<{ jsonPath: string }> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const objectPath = `${sessionPath}/reports/summary.json`;
    
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    await file.save(JSON.stringify(reportData, null, 2), {
      contentType: "application/json",
      resumable: false,
    });
    
    return { jsonPath: `/${bucketName}/${objectPath}` };
  }

  static async savePdf(
    clientName: string,
    sessionId: number,
    pdfBuffer: Buffer
  ): Promise<string> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const objectPath = `${sessionPath}/reports/report.pdf`;
    
    const bucketName = getBucketName();
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    await file.save(pdfBuffer, {
      contentType: "application/pdf",
      resumable: false,
    });
    
    return `/${bucketName}/${objectPath}`;
  }

  static async readFile(objectPath: string): Promise<Buffer | null> {
    try {
      // Parse the object path: /<bucket-name>/<object-path>
      const pathWithoutLeadingSlash = objectPath.startsWith("/") ? objectPath.slice(1) : objectPath;
      const parts = pathWithoutLeadingSlash.split("/");
      if (parts.length < 2) {
        console.error("Invalid object path:", objectPath);
        return null;
      }
      
      const bucketName = parts[0];
      const filePath = parts.slice(1).join("/");
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(filePath);
      
      const [exists] = await file.exists();
      if (!exists) {
        return null;
      }
      
      const [contents] = await file.download();
      return contents;
    } catch (error) {
      console.error("Error reading file from cloud storage:", error);
      return null;
    }
  }

  static async readTranscript(
    clientName: string,
    sessionId: number,
    questionId: number
  ): Promise<string | null> {
    const sessionPath = this.getSessionPath(clientName, sessionId);
    const objectPath = `${sessionPath}/transcripts/question-${questionId}.txt`;
    
    const bucketName = getBucketName();
    const fullPath = `/${bucketName}/${objectPath}`;
    
    const buffer = await this.readFile(fullPath);
    if (!buffer) return null;
    
    return buffer.toString("utf-8");
  }

  static async listSessionFiles(clientName: string, sessionId: number): Promise<string[]> {
    try {
      const sessionPath = this.getSessionPath(clientName, sessionId);
      const bucketName = getBucketName();
      const bucket = objectStorageClient.bucket(bucketName);
      
      const [files] = await bucket.getFiles({ prefix: sessionPath });
      return files.map(f => `/${bucketName}/${f.name}`);
    } catch (error) {
      console.error("Error listing session files:", error);
      return [];
    }
  }
}

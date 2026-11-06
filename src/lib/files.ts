import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function saveCv(file: File) {
  if (!CV_MIME_TYPES.has(file.type)) {
    throw new Error("Le CV doit être un fichier PDF, DOC ou DOCX.");
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    throw new Error("Le CV doit avoir une taille comprise entre 1 octet et 5 Mo.");
  }

  const uploadDir = process.env.CV_UPLOAD_DIR ?? "./data/cv";
  const extension = path.extname(file.name) || ".pdf";
  const fileName = `${randomUUID()}${extension}`;
  const fullPath = path.join(uploadDir, fileName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(fullPath, Buffer.from(await file.arrayBuffer()));

  return { fullPath, fileName, originalName: file.name };
}

export async function readCv(filePath: string) {
  const normalizedPath = path.resolve(filePath);
  const uploadDir = path.resolve(process.env.CV_UPLOAD_DIR ?? "./data/cv");
  if (!normalizedPath.startsWith(uploadDir)) {
    throw new Error("Invalid CV path.");
  }
  return readFile(normalizedPath);
}

export async function extractCvContent(filePath: string) {
  const fileBuffer = await readCv(filePath);
  const extension = path.extname(filePath).toLowerCase();
  let content = "";

  if (extension === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });

    try {
      const result = await parser.getText();
      content = result.text;
    } finally {
      await parser.destroy();
    }
  } else if (extension === ".docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    content = result.value;
  } else if (extension === ".doc") {
    const { default: WordExtractor } = await import("word-extractor");
    const extractor = new WordExtractor();
    const document = await extractor.extract(fileBuffer);
    content = document.getText();
  } else {
    throw new Error("Le format de CV n'est pas pris en charge.");
  }

  const normalizedContent = content.replace(/\s+/g, " ").trim();
  if (normalizedContent.length < 20) {
    throw new Error("Le CV ne contient pas de texte exploitable.");
  }

  return normalizedContent.slice(0, 12000);
}

export async function deleteCv(filePath: string) {
  await unlink(filePath).catch(() => undefined);
}


import { Document } from "@langchain/core/documents";
import { clearVectorStore, addDocuments } from "../rag/vector_store";
import fs from "fs/promises";
import path from "path";
import logger from "../lib/logger";

interface DocumentMetadata {
  source: string;
  path: string;
}

async function ensureDirectoryExists(dir: string) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
    logger.info("Created documents directory", { path: dir });
  }
}

async function loadDocuments() {
  const documentsDir = path.join(process.cwd(), "documents");

  try {
    // Ensure documents directory exists
    await ensureDirectoryExists(documentsDir);

    // Clear existing documents
    await clearVectorStore();

    // Read and filter text files
    const files = await fs.readdir(documentsDir);
    const textFiles = files.filter((file) => /\.(txt|md)$/.test(file));

    if (textFiles.length === 0) {
      logger.warn("No text or markdown files found in documents directory");
      return;
    }

    // Process documents in parallel
    const documents = await Promise.all(
      textFiles.map(async (file) => {
        try {
          const content = await fs.readFile(
            path.join(documentsDir, file),
            "utf-8"
          );
          return new Document<DocumentMetadata>({
            pageContent: content.trim(),
            metadata: {
              source: file,
              path: path.join(documentsDir, file),
            },
          });
        } catch (error) {
          logger.error("Failed to read file", { file, error: String(error) });
          return null;
        }
      })
    );

    // Filter out failed reads and empty documents
    const validDocuments = documents.filter(
      (doc): doc is Document<DocumentMetadata> =>
        doc !== null && doc.pageContent.length > 0
    );

    if (validDocuments.length === 0) {
      logger.warn("No valid documents found to process");
      return;
    }

    // Add documents to vector store
    await addDocuments(validDocuments);

    logger.info("Document loading completed", {
      totalFiles: textFiles.length,
      validDocuments: validDocuments.length,
      skippedFiles: textFiles.length - validDocuments.length,
    });
  } catch (error) {
    logger.error("Failed to load documents", { error: String(error) });
    process.exit(1);
  }
}

if (require.main === module) {
  loadDocuments().catch((error) => {
    logger.error("Script failed", { error: String(error) });
    process.exit(1);
  });
}

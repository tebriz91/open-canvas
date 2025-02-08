import { processDocument } from "./document_processing";
import {
  addDocumentsToVectorStore,
  initializeVectorStore,
  getVectorStoreStatus,
} from "./vector_store";
import fs from "fs/promises";
import path from "path";
import logger from "../lib/logger";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Loads all documents from a directory into the vector store
 */
export async function loadDocumentsIntoVectorStore(
  documentsDir: string,
  retryCount = 0
) {
  logger.info("Starting documents loading process", {
    documentsDir,
    attempt: retryCount + 1,
  });

  try {
    // Initialize vector store first
    await initializeVectorStore();

    // Read all files in the documents directory
    const files = await fs.readdir(documentsDir);
    if (files.length === 0) {
      logger.warn("No files found in documents directory", { documentsDir });
      return;
    }

    logger.info("Found files in documents directory", {
      fileCount: files.length,
      files: files.map((f) => ({
        name: f,
        extension: path.extname(f),
      })),
    });

    let totalDocumentsProcessed = 0;
    let totalChunksCreated = 0;
    const failedFiles: string[] = [];

    for (const file of files) {
      if (file.endsWith(".txt") || file.endsWith(".md")) {
        const filePath = path.join(documentsDir, file);
        try {
          logger.debug("Processing file", {
            fileName: file,
            filePath,
          });

          const content = await fs.readFile(filePath, "utf-8");
          if (!content.trim()) {
            logger.warn("Empty file found", { fileName: file });
            continue;
          }

          logger.debug("File content read", {
            fileName: file,
            contentLength: content.length,
            contentPreview: content.substring(0, 100) + "...",
          });

          // Process the document
          const documents = await processDocument(content, file);
          if (documents.length === 0) {
            logger.warn("No chunks created for file", { fileName: file });
            continue;
          }

          totalDocumentsProcessed++;
          totalChunksCreated += documents.length;

          // Add to vector store
          await addDocumentsToVectorStore(documents);
          logger.info(`Added document to vector store: ${file}`, {
            chunksCreated: documents.length,
            fileName: file,
          });
        } catch (error) {
          logger.error("Error processing file", {
            fileName: file,
            error: error instanceof Error ? error.message : String(error),
          });
          failedFiles.push(file);
        }
      } else {
        logger.debug("Skipping non-text file", {
          fileName: file,
          extension: path.extname(file),
        });
      }
    }

    const status = getVectorStoreStatus();
    logger.info("Document loading process completed", {
      totalFiles: files.length,
      totalDocumentsProcessed,
      totalChunksCreated,
      failedFiles,
      vectorStoreStatus: status,
    });

    if (failedFiles.length > 0 && retryCount < MAX_RETRIES) {
      logger.info("Retrying failed files", {
        failedFiles,
        attempt: retryCount + 1,
      });
      await delay(RETRY_DELAY);
      await loadDocumentsIntoVectorStore(documentsDir, retryCount + 1);
    }
  } catch (error) {
    logger.error("Error loading documents", {
      error: error instanceof Error ? error.message : String(error),
      documentsDir,
      attempt: retryCount + 1,
    });

    if (retryCount < MAX_RETRIES) {
      logger.info("Retrying document loading", {
        attempt: retryCount + 1,
      });
      await delay(RETRY_DELAY);
      await loadDocumentsIntoVectorStore(documentsDir, retryCount + 1);
    } else {
      throw error;
    }
  }
}

// Export a function to initialize the RAG system
export async function initializeRAG() {
  try {
    const documentsDir = path.join(process.cwd(), "documents");
    await loadDocumentsIntoVectorStore(documentsDir);
  } catch (error) {
    logger.error("Failed to initialize RAG system", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

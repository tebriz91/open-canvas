import { loadDocumentsIntoVectorStore } from "../rag/initialize";
import { getVectorStoreStatus } from "../rag/vector_store";
import path from "path";
import logger from "../lib/logger";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

// Script configuration
const COLLECTION_NAME = "legal-documents";
const CHROMA_URL = "http://localhost:8000";

async function clearExistingDocuments(): Promise<void> {
  try {
    // Create a temporary client to delete the collection
    const embeddings = new OpenAIEmbeddings();
    const client = new Chroma(embeddings, {
      collectionName: COLLECTION_NAME,
      url: CHROMA_URL,
    });

    logger.info("Clearing existing documents from vector store");
    await client.delete({ ids: [] }); // Delete all documents
    logger.info("Successfully cleared vector store");
  } catch (error) {
    logger.warn("Failed to clear vector store", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue execution even if clearing fails
  }
}

async function main() {
  const documentsDir = path.join(process.cwd(), "documents");

  try {
    logger.info("Starting document loading process", {
      documentsDir,
      cwd: process.cwd(),
    });

    // Get initial store status
    const initialStatus = await getVectorStoreStatus();
    logger.info("Initial vector store status", initialStatus);

    // Clear existing documents
    await clearExistingDocuments();

    // Load new documents
    await loadDocumentsIntoVectorStore(documentsDir);

    // Get final store status
    const finalStatus = await getVectorStoreStatus();
    logger.info("Document loading completed successfully", {
      initialDocumentCount: initialStatus.documentCount,
      finalDocumentCount: finalStatus.documentCount,
      documentsAdded: finalStatus.documentCount - initialStatus.documentCount,
    });

    process.exit(0);
  } catch (error) {
    logger.error("Document loading failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      documentsDir,
    });
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", () => {
  logger.warn("Process interrupted, cleaning up...");
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled promise rejection", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

// Run the script
main();

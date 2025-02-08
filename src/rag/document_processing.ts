import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import logger from "../lib/logger";

export async function processDocument(
  documentContent: string,
  documentName: string
): Promise<Document[]> {
  if (!documentContent) {
    logger.warn("Empty document content provided", { documentName });
    return [];
  }

  logger.info("Starting document processing", {
    documentName,
    contentLength: documentContent.length,
    contentPreview: documentContent.substring(0, 100) + "...",
  });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", ". ", "! ", "? "], // Custom separators for better chunk boundaries
  });

  try {
    logger.debug("Splitting document into chunks", {
      documentName,
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const documents = await splitter.splitDocuments([
      new Document({
        pageContent: documentContent,
        metadata: {
          source: documentName,
          length: documentContent.length,
          created: new Date().toISOString(),
        },
      }),
    ]);

    logger.info("Document processing completed", {
      documentName,
      chunksCreated: documents.length,
      chunkSizes: documents.map((doc) => doc.pageContent.length),
      chunkPreviews: documents.map((doc) => ({
        size: doc.pageContent.length,
        preview: doc.pageContent.substring(0, 100) + "...",
      })),
    });

    return documents;
  } catch (error) {
    logger.error("Error processing document", {
      documentName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return [];
  }
}

import { Document } from "@langchain/core/documents";
import {
  initializeVectorStore,
  addDocumentsToVectorStore,
  performVectorSearch,
} from "./vector_store";
import logger from "../lib/logger";
import fs from "fs/promises";
import path from "path";

async function loadDocumentsFromFolder(
  documentsDir: string
): Promise<Document[]> {
  logger.info("Loading documents from folder", { documentsDir });
  const files = await fs.readdir(documentsDir);
  const documents: Document[] = [];

  for (const file of files) {
    if (file.endsWith(".txt") || file.endsWith(".md")) {
      const filePath = path.join(documentsDir, file);
      const content = await fs.readFile(filePath, "utf-8");
      documents.push(
        new Document({
          pageContent: content,
          metadata: { source: file },
        })
      );
      logger.info("Loaded document", {
        fileName: file,
        contentLength: content.length,
        contentPreview: content.substring(0, 100) + "...",
      });
    }
  }

  return documents;
}

async function runTests() {
  logger.info("Starting RAG functionality tests");

  try {
    // Test 1: Initialize Vector Store
    logger.info("Test 1: Initializing vector store");
    const store = await initializeVectorStore();
    if (!store) {
      throw new Error("Vector store initialization failed");
    }
    logger.info("✓ Vector store initialized successfully");

    // Test 2: Load and Add Documents
    logger.info("Test 2: Loading and adding documents from documents folder");
    const documentsDir = path.join(process.cwd(), "documents");
    const testDocs = await loadDocumentsFromFolder(documentsDir);

    if (testDocs.length === 0) {
      throw new Error("No documents found in documents folder");
    }

    await addDocumentsToVectorStore(testDocs);
    logger.info("✓ Documents added successfully", {
      documentCount: testDocs.length,
      documents: testDocs.map((doc) => ({
        source: doc.metadata.source,
        contentLength: doc.pageContent.length,
      })),
    });

    // Test 3: Perform Search with Document Content
    logger.info("Test 3: Testing vector search with document content");
    // Extract a snippet from the first document to use as a search query
    const searchSnippet = testDocs[0].pageContent
      .split(" ")
      .slice(0, 5)
      .join(" "); // First 5 words
    const searchResults = await performVectorSearch(searchSnippet, 2);

    if (searchResults.length === 0) {
      throw new Error("Search returned no results");
    }
    logger.info("✓ Search returned results successfully", {
      query: searchSnippet,
      resultCount: searchResults.length,
      results: searchResults.map((doc) => ({
        source: doc.metadata.source,
        preview: doc.pageContent.substring(0, 100) + "...",
      })),
    });

    // Test 4: Verify Search Limit
    logger.info("Test 4: Testing search result limit");
    const limitedResults = await performVectorSearch(searchSnippet, 1);
    if (limitedResults.length > 1) {
      throw new Error("Search did not respect result limit");
    }
    logger.info("✓ Search limit respected successfully", {
      requestedLimit: 1,
      actualResults: limitedResults.length,
    });

    logger.info("All tests completed successfully");
  } catch (error) {
    logger.error("Test failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Run the tests
runTests();

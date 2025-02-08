import { initializeRAG } from "../rag/initialize";
import { performVectorSearch } from "../rag/vector_store";
import logger from "../lib/logger";

async function testRAG() {
  logger.info("Starting RAG system test");

  try {
    // Step 1: Initialize RAG system
    logger.info("Step 1: Initializing RAG system");
    await initializeRAG();

    // Step 2: Test search with various queries
    logger.info("Step 2: Testing vector search with sample queries");

    const queries = [
      "гражданская оборона",
      "инструктаж",
      "эвакуация",
      "чрезвычайная ситуация",
    ];

    for (const query of queries) {
      logger.info(`Testing search with query: "${query}"`);
      const results = await performVectorSearch(query, 2);

      if (results.length > 0) {
        logger.info("Search results found", {
          query,
          resultCount: results.length,
          results: results.map((doc) => ({
            source: doc.metadata?.source,
            preview: doc.pageContent.substring(0, 100) + "...",
          })),
        });
      } else {
        logger.warn("No results found for query", { query });
      }
    }

    logger.info("RAG system test completed successfully");
  } catch (error) {
    logger.error("RAG system test failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Run the test
testRAG().catch((error) => {
  logger.error("Unhandled error in RAG test", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

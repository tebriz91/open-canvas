import { OpenCanvasGraphAnnotation, OpenCanvasGraphReturnType } from "../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { searchDocuments } from "@/rag/vector_store";
import logger from "../../../lib/logger";
import { Document } from "@langchain/core/documents";

/**
 * Configuration Constants
 * ---------------------
 * MIN_QUERY_LENGTH: Minimum length required for a query to be considered valid.
 *                   Prevents processing of empty or too short queries that might not yield meaningful results.
 * MAX_CONTEXT_LENGTH: Maximum allowed length for the assembled context.
 *                     Prevents context from becoming too large for the model to process effectively.
 */
const MIN_QUERY_LENGTH = 3;
const MAX_CONTEXT_LENGTH = 8000;

/**
 * Assembles context from retrieved documents by grouping and concatenating them.
 *
 * The function performs the following steps:
 * 1. Groups documents by their source
 * 2. Maintains document order within each source using chunk indices
 * 3. Combines documents while respecting the maximum context length
 * 4. Formats the context with source information and separators
 *
 * @param documents - Array of Document objects containing content and metadata
 * @returns Formatted string containing the assembled context
 */
function assembleContext(documents: Document[]): string {
  logger.debug("Starting context assembly", {
    documentCount: documents.length,
  });

  // Group documents by their source to maintain logical organization
  const docGroups = documents.reduce(
    (groups, doc) => {
      const source = doc.metadata?.source || "unknown";
      if (!groups[source]) groups[source] = [];
      groups[source].push(doc);
      return groups;
    },
    {} as Record<string, Document[]>
  );

  // Documents are pre-sorted by chunk_index from vector_store.ts
  logger.debug("Grouped documents by source", {
    sourceCount: Object.keys(docGroups).length,
    sources: Object.keys(docGroups),
  });

  // Assemble context while respecting length limits
  const contextParts: string[] = [];
  let totalLength = 0;

  // Process each source group, maintaining source attribution
  for (const [source, docs] of Object.entries(docGroups)) {
    const sourceContent = docs.map((doc) => doc.pageContent).join("\n\n");

    // Check if adding this source's content would exceed the length limit
    if (totalLength + sourceContent.length > MAX_CONTEXT_LENGTH) {
      logger.debug("Reached maximum context length", {
        source,
        skippedDocsCount: docs.length,
        currentLength: totalLength,
        maxLength: MAX_CONTEXT_LENGTH,
      });
      break;
    }

    // Add source attribution and content
    contextParts.push(`Source: ${source}\n\n${sourceContent}`);
    totalLength += sourceContent.length;
    logger.debug("Added source content to context", {
      source,
      addedDocsCount: docs.length,
      newTotalLength: totalLength,
    });
  }

  // Combine all parts with separators
  const finalContext = contextParts.join("\n\n---\n\n");
  logger.debug("Assembled final context", {
    finalLength: finalContext.length,
    sourceCount: contextParts.length,
  });
  return finalContext;
}

/**
 * Main RAG (Retrieval-Augmented Generation) node for the OpenCanvas graph.
 *
 * This node performs the following operations:
 * 1. Extracts a query from either the last human message or artifact content
 * 2. Performs semantic search using the query to retrieve relevant documents
 * 3. Assembles the retrieved documents into a coherent context
 *
 * The assembled context is then passed to the next node (rewriteArtifact)
 * for use in generating or modifying content.
 *
 * @param state - Current state of the OpenCanvas graph
 * @param _config - Configuration for the graph node (unused)
 * @returns Updated graph state with retrieved context
 */
export const ragRetrievalNode = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  _config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  logger.info("Starting RAG retrieval process");

  // Initialize query variables
  let query = "";
  let querySource = "";

  // First attempt to extract query from the last human message
  const lastHumanMessage = state.messages.findLast(
    (message) => message.getType() === "human"
  );

  if (lastHumanMessage) {
    // Handle different content types (string or array)
    const queryContent = lastHumanMessage.content;
    query =
      typeof queryContent === "string"
        ? queryContent
        : Array.isArray(queryContent)
          ? queryContent.join(" ")
          : "";
    querySource = "human_message";
    logger.debug("Using query from last human message", {
      queryLength: query.length,
      querySource,
    });
  }

  // Validate query length and return early if insufficient
  if (!query || query.length < MIN_QUERY_LENGTH) {
    logger.info("Query too short or empty, skipping retrieval", {
      queryLength: query.length,
      minRequired: MIN_QUERY_LENGTH,
      querySource,
    });
    return {
      messages: state.messages,
      next: "rewriteArtifact",
      artifact: state.artifact,
      context: "",
    };
  }

  try {
    // Perform semantic search using the validated query
    logger.info("Performing vector search", {
      queryLength: query.length,
      querySource,
    });

    const contextDocuments = await searchDocuments(query, 5);

    // Log search results for debugging
    logger.debug("Vector search results", {
      documentsFound: contextDocuments.length,
      documents: contextDocuments.map((doc) => ({
        source: doc.metadata?.source,
        chunkIndex: doc.metadata?.chunk_index,
        contentLength: doc.pageContent.length,
      })),
      querySource,
    });

    // Handle case where no relevant documents are found
    if (!contextDocuments || contextDocuments.length === 0) {
      logger.info("No relevant documents found in vector search", {
        querySource,
      });
      return {
        messages: state.messages,
        next: "rewriteArtifact",
        artifact: state.artifact,
        context: "",
      };
    }

    // Process and assemble the retrieved documents
    logger.info("Assembling context from retrieved documents");
    const contextText = assembleContext(contextDocuments);

    logger.info("RAG retrieval completed successfully", {
      contextLength: contextText.length,
      documentCount: contextDocuments.length,
      querySource,
    });

    // Return the assembled context for use in the next node
    return {
      messages: state.messages,
      next: "rewriteArtifact",
      artifact: state.artifact,
      context: contextText,
    };
  } catch (error) {
    // Handle and log any errors during retrieval
    logger.error("Error during RAG retrieval", {
      error: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 100) + "...", // Truncate long queries in logs
      querySource,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return empty context in case of error
    return {
      messages: state.messages,
      next: "rewriteArtifact",
      artifact: state.artifact,
      context: "",
    };
  }
};

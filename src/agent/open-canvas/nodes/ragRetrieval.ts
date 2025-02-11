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
 * 1. Groups documents by their source or legal section if available
 * 2. Maintains document order within each group using chunk indices
 * 3. Combines documents while respecting the maximum context length
 * 4. Formats the context with group (section/source) information and separators
 *
 * @param documents - Array of Document objects containing content and metadata
 * @returns Formatted string containing the assembled context
 */
function assembleContext(documents: Document[]): string {
  logger.debug("Starting context assembly", {
    documentCount: documents.length,
  });

  // Group documents by their legal section if available; otherwise, fallback to source.
  const docGroups = documents.reduce(
    (groups, doc) => {
      const groupKey =
        doc.metadata?.section || doc.metadata?.source || "unknown";
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(doc);
      return groups;
    },
    {} as Record<string, Document[]>
  );

  logger.debug("Grouped documents by legal section/source", {
    groupCount: Object.keys(docGroups).length,
    groups: Object.keys(docGroups),
  });

  // Assemble context while respecting length limits
  const contextParts: string[] = [];
  let totalLength = 0;

  for (const [groupKey, docs] of Object.entries(docGroups)) {
    const groupContent = docs.map((doc) => doc.pageContent).join("\n\n");

    // Respect the maximum allowable context length
    if (totalLength + groupContent.length > MAX_CONTEXT_LENGTH) {
      logger.debug("Reached maximum context length", {
        group: groupKey,
        skippedDocsCount: docs.length,
        currentLength: totalLength,
        maxLength: MAX_CONTEXT_LENGTH,
      });
      break;
    }

    // Add source attribution and content
    contextParts.push(`Section/Source: ${groupKey}\n\n${groupContent}`);
    totalLength += groupContent.length;
    logger.debug("Added group content to context", {
      group: groupKey,
      docsCount: docs.length,
      newTotalLength: totalLength,
    });
  }

  // Combine all parts with separators
  const finalContext = contextParts.join("\n\n---\n\n");
  logger.debug("Assembled final context", {
    finalLength: finalContext.length,
    groupCount: contextParts.length,
  });
  return finalContext;
}

/**
 * Main RAG (Retrieval-Augmented Generation) node for the OpenCanvas graph.
 *
 * This node:
 * 1. Extracts the query from the latest human message.
 * 2. Executes semantic search (with our legal-aware vector store) to return relevant legal document chunks.
 * 3. Assembles the retrieved chunks preserving their legal coherence.
 *
 * @param state - Current state of the OpenCanvas graph
 * @param _config - Configuration for the graph node (unused)
 * @returns Updated graph state with the assembled context
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
        section: doc.metadata?.section,
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
      query: query.substring(0, 100) + "...",
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

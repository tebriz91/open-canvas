import { OpenCanvasGraphAnnotation, OpenCanvasGraphReturnType } from "../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { performVectorSearch } from "@/rag/vector_store";
import logger from "../../../lib/logger";
import { getArtifactContent } from "@/contexts/utils";
import { isArtifactMarkdownContent } from "@/lib/artifact_content_types";
import { Document } from "@langchain/core/documents";

// Configuration constants for RAG retrieval
const MIN_QUERY_LENGTH = 3; // Minimum length for meaningful search
const MAX_RETRIES = 3; // Maximum retry attempts for operations
const RETRY_DELAY_MS = 1000; // Initial delay between retries
const MAX_CONTEXT_LENGTH = 8000; // Maximum length of assembled context

// Retry mechanism with exponential backoff for handling transient failures
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = RETRY_DELAY_MS
): Promise<T> {
  let attempts = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) throw error;
      const delay = initialDelay * Math.pow(2, attempts - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Assemble context from retrieved documents, maintaining source grouping and order
function assembleContext(documents: Document[]): string {
  // Group documents by their source
  const docGroups = documents.reduce(
    (groups, doc) => {
      const source = doc.metadata?.source || "unknown";
      if (!groups[source]) groups[source] = [];
      groups[source].push(doc);
      return groups;
    },
    {} as Record<string, Document[]>
  );

  // Sort documents within each group by their chunk index
  Object.values(docGroups).forEach((group) => {
    group.sort(
      (a, b) => (a.metadata?.chunk_index || 0) - (b.metadata?.chunk_index || 0)
    );
  });

  // Combine documents while respecting length limits
  const contextParts: string[] = [];
  let totalLength = 0;

  for (const [source, docs] of Object.entries(docGroups)) {
    const sourceContent = docs.map((doc) => doc.pageContent).join("\n\n");
    if (totalLength + sourceContent.length > MAX_CONTEXT_LENGTH) break;
    contextParts.push(`Source: ${source}\n\n${sourceContent}`);
    totalLength += sourceContent.length;
  }

  return contextParts.join("\n\n---\n\n");
}

// Main RAG retrieval node for processing queries and retrieving relevant context
export const ragRetrievalNode = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  _config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  let query: string | undefined;

  // Extract query from last human message or artifact content
  const lastHumanMessage = state.messages.findLast(
    (message) => message.getType() === "human"
  );

  if (
    lastHumanMessage?.content &&
    typeof lastHumanMessage.content === "string"
  ) {
    query = lastHumanMessage.content;
  } else if (state.customQuickActionId === "rag_rewrite" && state.artifact) {
    const artifactContent = getArtifactContent(state.artifact);
    if (isArtifactMarkdownContent(artifactContent)) {
      query = artifactContent.fullMarkdown;
    }
  }

  // Return early if no valid query found
  if (!query) {
    return { messages: state.messages };
  }

  // Validate query length
  if (query.length < MIN_QUERY_LENGTH) {
    return {
      messages: state.messages,
      next: "rewriteArtifact",
      artifact: state.artifact,
      context: "",
    };
  }

  try {
    // Perform vector search with retry mechanism
    const contextDocuments = await retryWithBackoff(() =>
      performVectorSearch(query!, 5, {
        filter: state.artifact?.id
          ? { artifact_id: state.artifact.id }
          : undefined,
      })
    );

    // Handle case when no relevant documents found
    if (!contextDocuments || contextDocuments.length === 0) {
      return {
        messages: state.messages,
        next: "rewriteArtifact",
        artifact: state.artifact,
        context: "",
      };
    }

    // Process and assemble final context
    const contextText = assembleContext(contextDocuments);

    return {
      messages: state.messages,
      next: "rewriteArtifact",
      artifact: state.artifact,
      context: contextText,
    };
  } catch (error) {
    logger.error("Error during RAG retrieval", {
      error: error instanceof Error ? error.message : String(error),
      type: error instanceof Error ? error.constructor.name : typeof error,
    });

    return {
      messages: state.messages,
      next: "rewriteArtifact",
      artifact: state.artifact,
      context: "",
    };
  }
};

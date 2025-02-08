import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import logger from "../lib/logger";

// Singleton instance of the vector store for document storage and retrieval
let vectorStore: Chroma | null = null;
const COLLECTION_NAME = "legal-documents";

// Configuration for text chunking to optimize for context windows
const TEXT_SPLITTER_CONFIG = {
  chunkSize: 2000, // Characters per chunk
  chunkOverlap: 400, // Overlap between chunks to maintain context
  separators: ["\n\n", "\n", " ", ""], // Priority order for splitting
  keepSeparator: true, // Preserve document structure
};

// Initialize or return existing vector store instance
export async function initializeVectorStore() {
  if (!vectorStore) {
    try {
      const embeddings = new OpenAIEmbeddings();
      vectorStore = new Chroma(embeddings, {
        collectionName: COLLECTION_NAME,
        url: "http://localhost:8000", // ChromaDB server URL
        collectionMetadata: {
          "hnsw:space": "cosine", // Use cosine similarity for vector matching
        },
      });
    } catch (error) {
      logger.error("Failed to initialize vector store", { error });
      throw error;
    }
  }
  return vectorStore;
}

// Process and store documents in the vector store with metadata
export async function addDocumentsToVectorStore(documents: Document[]) {
  if (!documents || documents.length === 0) return;

  // Split documents into smaller chunks for better retrieval
  const textSplitter = new RecursiveCharacterTextSplitter(TEXT_SPLITTER_CONFIG);

  const processedDocs: Document[] = [];
  for (const doc of documents) {
    // Split document content while preserving structure
    const chunks = await textSplitter.splitText(doc.pageContent);

    // Create new documents from chunks with enhanced metadata
    const docChunks = chunks.map(
      (chunk, index) =>
        new Document({
          pageContent: chunk,
          metadata: {
            ...doc.metadata,
            artifact_id: doc.metadata?.artifact_id || "unknown", // Add artifact identifier
            version: doc.metadata?.version || 1, // Track version history
            chunk_index: index,
          },
        })
    );
    processedDocs.push(...docChunks);
  }

  const store = vectorStore ?? (await initializeVectorStore());
  if (!store) throw new Error("Failed to initialize vector store");

  try {
    await store.addDocuments(processedDocs);
  } catch (_error) {
    logger.error("Failed to add documents to vector store");
    throw _error;
  }
}

// Search for relevant documents based on query similarity
export async function performVectorSearch(
  query: string,
  k: number = 3,
  options?: { filter?: Record<string, any> }
) {
  if (!query) return [];

  const store = vectorStore ?? (await initializeVectorStore());
  if (!store) throw new Error("Failed to initialize vector store");

  try {
    // Verify store has documents
    const totalDocs = await store.collection?.count();
    if (!totalDocs) throw new Error("Vector store is empty");

    // Perform semantic search with optional filtering
    const results = await store.similaritySearch(query, k, options?.filter);

    // Sort results by chunk_index to maintain document coherence
    results.sort((a, b) => {
      if (a.metadata.source === b.metadata.source) {
        return (a.metadata.chunk_index || 0) - (b.metadata.chunk_index || 0);
      }
      return 0;
    });

    return results;
  } catch (error) {
    logger.error("Vector search failed", { error });
    throw error;
  }
}

// Get current status of vector store
export async function getVectorStoreStatus() {
  if (!vectorStore) {
    return { isInitialized: false, documentCount: 0 };
  }

  try {
    const count = (await vectorStore.collection?.count()) ?? 0;
    return { isInitialized: true, documentCount: count };
  } catch (_error) {
    return { isInitialized: false, documentCount: 0 };
  }
}

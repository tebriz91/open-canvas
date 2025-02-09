import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import logger from "../lib/logger";

const COLLECTION_NAME = "documents";
const CHROMA_URL = "http://localhost:8000";

let vectorStore: Chroma | null = null;

export async function initVectorStore(): Promise<Chroma> {
  if (!vectorStore) {
    const embeddings = new OpenAIEmbeddings();
    vectorStore = new Chroma(embeddings, {
      collectionName: COLLECTION_NAME,
      url: CHROMA_URL,
    });
  }
  return vectorStore;
}

export async function addDocuments(documents: Document[]) {
  if (!documents || documents.length === 0) return;

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  try {
    const store = await initVectorStore();

    const processedDocs = [];
    for (const doc of documents) {
      const chunks = await textSplitter.splitDocuments([doc]);
      const docChunks = chunks.map(
        (chunk, index) =>
          new Document({
            pageContent: chunk.pageContent,
            metadata: {
              ...chunk.metadata,
              chunk_index: index,
            },
          })
      );
      processedDocs.push(...docChunks);
    }

    await store.addDocuments(processedDocs);
    logger.debug("Documents added to vector store", {
      count: processedDocs.length,
    });
  } catch (error) {
    logger.error("Failed to add documents", { error: String(error) });
    throw error;
  }
}

export async function searchDocuments(
  query: string,
  k: number = 3,
  filter?: Record<string, any>
) {
  if (!query) return [];

  try {
    const store = await initVectorStore();
    const results = await store.similaritySearch(query, k, filter);

    // Sort by chunk index to maintain document coherence
    return results.sort(
      (a, b) => (a.metadata.chunk_index || 0) - (b.metadata.chunk_index || 0)
    );
  } catch (error) {
    logger.error("Search failed", { error: String(error) });
    throw error;
  }
}

export async function clearVectorStore() {
  try {
    const store = await initVectorStore();
    const collection = await store.collection;

    if (!collection) {
      logger.warn("No collection found to clear");
      return;
    }

    // Get all document IDs
    const count = await collection.count();
    if (count > 0) {
      const ids = await collection.get({ limit: count }).then((res) => res.ids);
      if (ids.length > 0) {
        await store.delete({ ids });
        logger.info("Cleared vector store", { deletedCount: ids.length });
      }
    }

    vectorStore = null;
  } catch (error) {
    logger.error("Failed to clear vector store", { error: String(error) });
    throw error;
  }
}

export async function getStoreStatus() {
  try {
    const store = await initVectorStore();
    const count = (await store.collection?.count()) || 0;
    return { initialized: true, documentCount: count };
  } catch (_error) {
    return { initialized: false, documentCount: 0 };
  }
}

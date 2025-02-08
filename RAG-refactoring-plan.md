# Implementing Simple RAG in Open Canvas

This guide outlines the steps to implement a simple Retrieval-Augmented Generation (RAG) system in the Open Canvas application, following the LangChain documentation and utilizing the existing codebase.

## Step-by-step plan

### Step 1: Install Necessary Dependencies

First, ensure you have the required LangChain packages for RAG. Check your `package.json` file and add the following if they are missing. You can run the following command in your terminal:

```bash
yarn add @langchain/openai @langchain/core @langchain/text-splitter @langchain/vectorstores @langchain/document_loaders @langchain/langgraph
```

After running this, your `package.json` should include these new dependencies.

### Step 2: Create Document Loading and Splitting Logic (Indexing Phase)

This step focuses on the **Indexing** phase, preparing your documents for retrieval.

```typescript
// src/rag/document_processing.ts
import { RecursiveCharacterTextSplitter } from "@langchain/text-splitter";
import { Document } from "@langchain/core/documents";

export async function processDocument(
  documentContent: string,
  documentName: string
): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  try {
    const documents = await splitter.splitDocuments([
      new Document({
        pageContent: documentContent,
        metadata: { source: documentName },
      }),
    ]);
    return documents;
  } catch (error) {
    console.error("Error splitting document:", error);
    return [];
  }
}
```

This code snippet defines a function `processDocument` that handles the **Splitting** part of the indexing phase:

- Takes `documentContent` (string) and `documentName` (string) as input.
- Uses `RecursiveCharacterTextSplitter` to break down the content into smaller chunks. We are using `RecursiveCharacterTextSplitter` as it is recommended for generic text use cases.

  - `chunkSize`: specifies the maximum size of each text chunk (1000 characters).
  - `chunkOverlap`: determines the overlap between adjacent chunks (200 characters), which helps maintain context continuity across chunks.

- Creates `Document` objects with the split content and metadata including the document name. Each chunk of text is encapsulated within a `Document` object, which is LangChain's standard format for handling text data.
- Returns an array of `Document` objects.

### Step 3: Set up Vector Store and Embedding Model (Indexing Phase - Storing)

Continuing the **Indexing** phase, this step focuses on setting up the **Vector Store** and **Embedding Model**. We'll use `MemoryVectorStore` for simplicity in this example and `OpenAIEmbeddings`. For production, consider more persistent vector stores like Pinecone, Qdrant, or Chroma

```typescript
// src/rag/vector_store.ts
import { MemoryVectorStore } from "@langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

let vectorStore: MemoryVectorStore | null = null;

export async function initializeVectorStore() {
  if (!vectorStore) {
    vectorStore = await MemoryVectorStore.fromTexts(
      ["Initial vector store."], // Initial text, can be replaced later
      [],
      new OpenAIEmbeddings()
    );
  }
  return vectorStore;
}

export async function addDocumentsToVectorStore(documents: Document[]) {
  if (!vectorStore) {
    await initializeVectorStore();
  }
  await vectorStore!.addDocuments(documents);
}

export async function performVectorSearch(query: string, k?: number) {
  if (!vectorStore) {
    await initializeVectorStore();
  }
  return await vectorStore!.similaritySearch(query, k);
}
```

This code sets up:

- `initializeVectorStore`: Initializes a `MemoryVectorStore` with `OpenAIEmbeddings`. It uses a singleton pattern to ensure only one vector store instance is initialized throughout the application. `OpenAIEmbeddings` is used to convert text into numerical vectors.
- `addDocumentsToVectorStore`: Adds an array of `Document` objects to the vector store. This function takes an array of `Document` objects (output from `processDocument`) and adds them to the vector store, making them searchable.
- `performVectorSearch`: Performs a similarity search in the vector store based on a query and returns the top `k` results. This function is the core of the retrieval process. It takes a query string and an optional number `k` (defaulting to a reasonable value if not provided), performs a similarity search against the vector store, and returns the top `k` most relevant documents.

### Step 4: Integrate RAG into LangGraph Agent (Retrieval and Generation Phase)

This step integrates the **Retrieval and Generation** phases into your LangGraph agent, leveraging the vector store created in the previous steps.

#### Step 4.1: Add a new node for Retrieval

Create a new node in your LangGraph graph for retrieval:

```typescript
// src/agent/open-canvas/nodes/ragRetrieval.ts
import { OpenCanvasGraphAnnotation, OpenCanvasGraphReturnType } from "../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { performVectorSearch } from "@/rag/vector_store";

export const ragRetrievalNode = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const query = state.messages.slice(-1)[0]?.content; // Get the latest message as query
  if (!query) {
    console.warn("No query found for RAG retrieval.");
    return {}; // Or handle appropriately if no query
  }

  try {
    const contextDocuments = await performVectorSearch(query, 3); // Retrieve top 3 documents
    const contextText = contextDocuments
      .map((doc) => doc.pageContent)
      .join("\n\n");
    return {
      context: contextText, // Add retrieved context to the state
      rewriteArtifactWithContext: true, // Signal to rewrite the artifact
    };
  } catch (error) {
    console.error("Error during vector search:", error);
    return {}; // Or handle error appropriately
  }
};
```

The ragRetrievalNode should pass the retrieved context to the rewriteArtifact node.

#### Step 4.2: Update the Graph Definition

Modify your graph definition in `src/agent/open-canvas/index.ts` to include the new `ragRetrievalNode` and connect it in the graph flow.

```typescript
// src/agent/open-canvas/index.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { OpenCanvasGraphAnnotation } from "./state";
import { generatePath } from "./nodes/generatePath";
import { replyToGeneralInput } from "./nodes/replyToGeneralInput";
import { rewriteArtifact } from "./nodes/rewrite-artifact";
import { rewriteArtifactTheme } from "./nodes/rewriteArtifactTheme";
import { updateHighlightedText } from "./nodes/updateHighlightedText";
import { generateArtifact } from "./nodes/generateArtifact";
import { customAction } from "./nodes/customAction";
import { generateFollowup } from "./nodes/generateFollowup";
import { cleanState } from "./nodes/cleanState";
import { reflectNode } from "./nodes/reflect";
import { generateTitleNode } from "./nodes/generateTitle";
import { routeNode } from "./nodes/route";
import { conditionallyGenerateTitle } from "./nodes/conditionallyGenerateTitle";
import { ragRetrievalNode } from "./nodes/ragRetrieval"; // Import new node

const builder = new StateGraph(OpenCanvasGraphAnnotation)
  // Start node & edge
  .addNode("generatePath", generatePath)
  .addEdge(START, "generatePath")
  // Nodes
  .addNode("replyToGeneralInput", replyToGeneralInput)
  .addNode("rewriteArtifact", rewriteArtifact)
  .addNode("rewriteArtifactTheme", rewriteArtifactTheme)
  .addNode("updateHighlightedText", updateHighlightedText)
  .addNode("generateArtifact", generateArtifact)
  .addNode("customAction", customAction)
  .addNode("generateFollowup", generateFollowup)
  .addNode("cleanState", cleanState)
  .addNode("reflect", reflectNode)
  .addNode("generateTitle", generateTitleNode)
  .addNode("ragRetrieval", ragRetrievalNode) // Add RAG retrieval node

  // Initial router
  .addConditionalEdges("generatePath", routeNode, [
    "rewriteArtifactTheme",
    "replyToGeneralInput",
    "generateArtifact",
    "rewriteArtifact",
    "customAction",
    "updateHighlightedText",
    "ragRetrieval", // Add RAG retrieval path
  ])

  // Edges
  .addEdge("generateArtifact", "generateFollowup")
  .addEdge("updateHighlightedText", "generateFollowup")
  .addEdge("rewriteArtifact", "generateFollowup")
  .addEdge("rewriteArtifactTheme", "generateFollowup")
  .addEdge("customAction", "generateFollowup")
  .addEdge("ragRetrieval", "generateFollowup")

  // End edges
  .addEdge("replyToGeneralInput", "cleanState")
  // Only reflect if an artifact was generated/updated.
  .addEdge("generateFollowup", "reflect")
  .addEdge("reflect", "cleanState")
  .addConditionalEdges("cleanState", conditionallyGenerateTitle, [
    END,
    "generateTitle",
  ])
  .addEdge("generateTitle", END);

export const graph = builder.compile().withConfig({ runName: "open_canvas" });
```

#### Step 4.3: Modify `rewriteArtifact` Node

Incorporate the context from the state into the prompt used to rewrite the artifact.

```typescript
// src/agent/open-canvas/nodes/rewrite-artifact/index.ts
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { optionallyUpdateArtifactMeta } from "./update-meta";
import { buildPrompt, createNewArtifactContent, validateState } from "./utils";
import {
  getFormattedReflections,
  getModelFromConfig,
  optionallyGetSystemPromptFromConfig,
} from "@/agent/utils";
import { isArtifactMarkdownContent } from "@/lib/artifact_content_types";

export const rewriteArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const smallModelWithConfig = (await getModelFromConfig(config)).withConfig({
    runName: "rewrite_artifact_model_call",
  });
  const memoriesAsString = await getFormattedReflections(config);
  const { currentArtifactContent, recentHumanMessage } = validateState(state);
  const artifactMetaToolCall = await optionallyUpdateArtifactMeta(
    state,
    config
  );
  const artifactType = artifactMetaToolCall?.args?.type;
  const isNewType = artifactType !== currentArtifactContent.type;

  const artifactContent = isArtifactMarkdownContent(currentArtifactContent)
    ? currentArtifactContent.fullMarkdown
    : "";

  // Incorporate context into the prompt
  let augmentedArtifactContent = artifactContent;
  if (state.context) {
    augmentedArtifactContent = `Context: ${state.context}\n\nOriginal Content: ${artifactContent}`;
  }

  const formattedPrompt = buildPrompt({
    artifactContent: augmentedArtifactContent, // Use augmented content
    memoriesAsString,
    isNewType,
    artifactMetaToolCall,
  });
  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedPrompt}`
    : formattedPrompt;

  const newArtifactResponse = await smallModelWithConfig.invoke([
    { role: "system", content: fullSystemPrompt },
    recentHumanMessage,
  ]);

  const newArtifactContent = createNewArtifactContent({
    artifactType,
    state,
    currentArtifactContent,
    artifactMetaToolCall,
    newContent: newArtifactResponse.content as string,
  });

  return {
    artifact: {
      ...state.artifact,
      currentIndex: state.artifact.contents.length + 1,
      contents: [...state.artifact.contents, newArtifactContent],
    },
  };
};
```

#### Step 4.4: Update `generatePath` Node to Route to `ragRetrievalNode`

Modify `generatePath` node (`src/agent/open-canvas/nodes/generatePath.ts`). Instead of routing all general inputs to ragRetrievalNode, we'll route to it only when a specific customQuickActionId is present in the state. This customQuickActionId will correspond to the "RAG Rewrite" action.

```typescript
// src/agent/open-canvas/nodes/generatePath.ts
import { OpenCanvasGraphAnnotation } from "../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";

export const generatePath = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
) => {
  if (state.highlightedText) {
    return {
      next: "updateHighlightedText",
    };
  }

  if (
    state.language ||
    state.artifactLength ||
    state.regenerateWithEmojis ||
    state.readingLevel
  ) {
    return {
      next: "rewriteArtifactTheme",
    };
  }

  if (state.customQuickActionId === "rag_rewrite") {
    // Check for the RAG rewrite action
    return {
      next: "ragRetrieval",
    };
  }

  if (state.customQuickActionId) {
    return {
      next: "customAction",
    };
  }

  return {
    next: "replyToGeneralInput", // Default path
  };
};
```

### Step 5: Frontend Integration

Add a "RAG Rewrite" quick action to your UI. When this action is triggered, set state.customQuickActionId = "rag_rewrite" before sending the state to the graph.

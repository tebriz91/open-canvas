import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  getFormattedReflections,
  getModelFromConfig,
  getModelConfig,
  optionallyGetSystemPromptFromConfig,
} from "@/agent/utils";
import { ARTIFACT_TOOL_SCHEMA } from "./schemas";
import { ArtifactV3 } from "@/types";
import { createArtifactContent, formatNewArtifactPrompt } from "./utils";
import { addDocumentsToVectorStore } from "@/rag/vector_store";
import { Document } from "@langchain/core/documents";
import logger from "@/lib/logger";

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const { modelName, modelProvider } = getModelConfig(config);
  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
  });

  const modelWithArtifactTool = smallModel.bindTools(
    [
      {
        name: "generate_artifact",
        schema: ARTIFACT_TOOL_SCHEMA,
      },
    ],
    // Ollama does not support tool choice
    { ...(modelProvider !== "ollama" && { tool_choice: "generate_artifact" }) }
  );

  const memoriesAsString = await getFormattedReflections(config);
  const formattedNewArtifactPrompt = formatNewArtifactPrompt(
    memoriesAsString,
    modelName
  );

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedNewArtifactPrompt}`
    : formattedNewArtifactPrompt;

  const response = await modelWithArtifactTool.invoke(
    [{ role: "system", content: fullSystemPrompt }, ...state.messages],
    { runName: "generate_artifact" }
  );

  const newArtifactContent = createArtifactContent(response.tool_calls?.[0]);
  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [newArtifactContent],
  };

  // Add the generated content to the vector store
  try {
    logger.info("Adding generated artifact to vector store", {
      title: newArtifactContent.title,
      contentLength: newArtifactContent.fullMarkdown?.length || 0,
    });

    const document = new Document({
      pageContent: newArtifactContent.fullMarkdown || "",
      metadata: {
        title: newArtifactContent.title,
        type: newArtifactContent.type,
        index: newArtifactContent.index,
        source: "generated_artifact",
      },
    });

    await addDocumentsToVectorStore([document]);

    logger.info("Successfully added artifact to vector store", {
      title: newArtifactContent.title,
    });
  } catch (error) {
    logger.error("Failed to add artifact to vector store", {
      error: error instanceof Error ? error.message : String(error),
      title: newArtifactContent.title,
    });
    // Continue even if vector store update fails
  }

  return {
    artifact: newArtifact,
  };
};

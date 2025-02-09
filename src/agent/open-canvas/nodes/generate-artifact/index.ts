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
import logger from "@/lib/logger";

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  logger.info("Starting artifact generation process");
  const { modelName, modelProvider } = getModelConfig(config);
  logger.debug("Model configuration", { modelName, modelProvider });

  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
  });
  logger.debug("Model initialized with temperature 0.5");

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
  logger.debug("Model bound with artifact generation tool");

  const memoriesAsString = await getFormattedReflections(config);
  logger.debug("Retrieved formatted reflections", {
    memoriesLength: memoriesAsString.length,
  });

  const formattedNewArtifactPrompt = formatNewArtifactPrompt(
    memoriesAsString,
    modelName
  );
  logger.debug("Formatted new artifact prompt", {
    promptLength: formattedNewArtifactPrompt.length,
  });

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${formattedNewArtifactPrompt}`
    : formattedNewArtifactPrompt;

  logger.debug("Assembled full system prompt", {
    hasUserSystemPrompt: !!userSystemPrompt,
    fullPromptLength: fullSystemPrompt.length,
  });

  logger.info("Invoking model for artifact generation");
  const response = await modelWithArtifactTool.invoke(
    [{ role: "system", content: fullSystemPrompt }, ...state.messages],
    { runName: "generate_artifact" }
  );
  logger.debug("Received model response", {
    hasToolCalls: !!response.tool_calls,
    toolCallsCount: response.tool_calls?.length || 0,
  });

  const newArtifactContent = createArtifactContent(response.tool_calls?.[0]);
  logger.debug("Created new artifact content", {
    title: newArtifactContent.title,
    type: newArtifactContent.type,
    contentLength: newArtifactContent.fullMarkdown?.length || 0,
    content: newArtifactContent.fullMarkdown,
  });

  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [newArtifactContent],
    metadata: {},
    id: crypto.randomUUID(),
  };
  logger.debug("Created new artifact object", {
    id: newArtifact.id,
    currentIndex: newArtifact.currentIndex,
    contentsLength: newArtifact.contents.length,
    content: newArtifact.contents[0].fullMarkdown,
  });

  logger.info("Successfully generated new artifact");
  return {
    artifact: newArtifact,
  };
};

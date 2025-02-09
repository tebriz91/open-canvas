/**
 * Rewrite Artifact Node
 * --------------------
 * This module is responsible for rewriting and improving artifacts based on
 * user queries and retrieved context. It uses an LLM to generate improved versions
 * of documents while maintaining their essential information and structure.
 *
 * The rewrite process includes:
 * - Validating input state and content
 * - Handling metadata updates and type changes
 * - Incorporating reflections and context
 * - Generating improved content using LLM
 * - Maintaining version history
 */

import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { optionallyUpdateArtifactMeta } from "./update-meta";
import { createNewArtifactContent, validateState } from "./utils";
import {
  getFormattedReflections,
  getModelFromConfig,
  optionallyGetSystemPromptFromConfig,
} from "@/agent/utils";
import logger from "@/lib/logger";

/**
 * Main rewrite artifact node for the OpenCanvas graph.
 *
 * This node performs the following operations:
 * 1. Validates state and extracts current content and messages
 * 2. Updates artifact metadata if needed (type changes, etc.)
 * 3. Incorporates reflections and context from previous interactions
 * 4. Generates improved content using LLM with custom prompts
 * 5. Maintains version history by appending new content
 *
 * @param state - Current state of the OpenCanvas graph, including messages and artifact
 * @param config - Configuration for the graph node, used for model initialization
 * @returns Updated graph state with the rewritten artifact appended to history
 */
export const rewriteArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  logger.info("Starting artifact rewrite process");

  // Initialize model with tracking configuration
  const smallModelWithConfig = (await getModelFromConfig(config)).withConfig({
    runName: "rewrite_artifact_model_call",
  });
  logger.debug("Model initialized with configuration");

  // Get reflections from previous interactions
  const memoriesAsString = await getFormattedReflections(config);

  // Validate state and extract required content
  const { currentArtifactContent, recentHumanMessage } = validateState(state);

  // Process metadata updates and track type changes
  const artifactMetaToolCall = await optionallyUpdateArtifactMeta(
    state,
    config
  );
  const artifactType = artifactMetaToolCall?.args?.type;
  const isNewType = artifactType !== currentArtifactContent.type;
  logger.debug("Metadata update processed", {
    hasMetaUpdate: !!artifactMetaToolCall,
    isNewType,
    newType: artifactType,
  });

  // Additional validation after metadata processing
  if (!currentArtifactContent || !recentHumanMessage) {
    logger.error("Missing required content or message");
    throw new Error("Missing required content or message");
  }

  // Track reflection context availability
  logger.debug("Retrieved reflections", {
    hasMemories: !!memoriesAsString,
  });

  // Build the system prompt with all available context
  const basePrompt = `Ты эксперт по переписыванию и улучшению документов.
Внимательно изучите следующие данные:
Запрос пользователя: ${recentHumanMessage?.content || "Нет запроса."}

Контекст, полученный из поиска (RAG):
${state.context || "Нет дополнительного контекста."}

${memoriesAsString ? `Релевантные воспоминания:\n${memoriesAsString}` : ""}

Исходный документ:
${currentArtifactContent.fullMarkdown}

Ваша задача – переписать и улучшить исходный документ c учетом всей предоставленной информации.`;

  // Incorporate user-provided system prompt if available
  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${basePrompt}`
    : basePrompt;

  try {
    // Generate improved content using the LLM
    logger.info("Invoking model for artifact rewrite");
    const response = await smallModelWithConfig.invoke([
      { role: "system", content: fullSystemPrompt },
      recentHumanMessage,
    ]);

    // Create new artifact content with metadata and type handling
    const newArtifactContent = createNewArtifactContent({
      artifactType,
      state,
      currentArtifactContent,
      artifactMetaToolCall,
      newContent: response.content as string,
    });

    logger.debug("Created new artifact content", {
      hasContent: !!newArtifactContent,
      type: artifactType,
    });

    // Append new version while maintaining history
    const updatedArtifact = {
      ...state.artifact,
      currentIndex: state.artifact.contents.length + 1,
      contents: [...state.artifact.contents, newArtifactContent],
    };

    logger.info("Successfully completed artifact rewrite");
    return {
      artifact: updatedArtifact,
      messages: state.messages,
    };
  } catch (error) {
    // Log detailed error information for debugging
    logger.error("Error during artifact rewrite", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

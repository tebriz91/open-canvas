import {
  CURRENT_ARTIFACT_PROMPT,
  NO_ARTIFACT_PROMPT,
  ROUTE_QUERY_OPTIONS_HAS_ARTIFACTS,
  ROUTE_QUERY_OPTIONS_NO_ARTIFACTS,
  ROUTE_QUERY_PROMPT,
} from "../prompts";
import { OpenCanvasGraphAnnotation } from "../state";
import { z } from "zod";
import { formatArtifactContentWithTemplate } from "../../utils";
import { getArtifactContent } from "../../../contexts/utils";
import { getModelFromConfig } from "../../utils";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import logger from "../../../lib/logger";

/**
 * Routes to the proper node in the graph based on the user's query and state.
 */
export const generatePath = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
) => {
  logger.info("Starting path generation", {
    hasArtifact: !!state.artifact,
    hasHighlightedText: !!state.highlightedText,
    customQuickActionId: state.customQuickActionId,
  });

  // Handle direct routing based on state flags
  if (state.highlightedText) {
    logger.info("Routing to updateHighlightedText due to highlighted text");
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
    logger.info(
      "Routing to rewriteArtifactTheme due to theme modification flags",
      {
        language: state.language,
        artifactLength: state.artifactLength,
        regenerateWithEmojis: state.regenerateWithEmojis,
        readingLevel: state.readingLevel,
      }
    );
    return {
      next: "rewriteArtifactTheme",
    };
  }

  // Handle RAG rewrite action
  if (state.customQuickActionId === "rag_rewrite") {
    logger.info("Routing to ragRetrieval for RAG rewrite action");
    return {
      next: "ragRetrieval",
    };
  }

  // Handle other custom actions
  if (state.customQuickActionId) {
    logger.info("Routing to customAction", {
      actionId: state.customQuickActionId,
    });
    return {
      next: "customAction",
    };
  }

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  logger.debug("Preparing LLM prompt for routing", {
    hasCurrentArtifact: !!currentArtifactContent,
    messageCount: state.messages.length,
  });

  // For messages without explicit state flags, use LLM to determine routing
  const formattedPrompt = ROUTE_QUERY_PROMPT.replace(
    "{artifactOptions}",
    currentArtifactContent
      ? ROUTE_QUERY_OPTIONS_HAS_ARTIFACTS
      : ROUTE_QUERY_OPTIONS_NO_ARTIFACTS
  )
    .replace(
      "{recentMessages}",
      state.messages
        .slice(-3)
        .map((message) => `${message.getType()}: ${message.content}`)
        .join("\n\n")
    )
    .replace(
      "{currentArtifactPrompt}",
      currentArtifactContent
        ? formatArtifactContentWithTemplate(
            CURRENT_ARTIFACT_PROMPT,
            currentArtifactContent
          )
        : NO_ARTIFACT_PROMPT
    );

  const artifactRoute = currentArtifactContent
    ? "rewriteArtifact"
    : "generateArtifact";

  logger.debug("Initializing model for routing decision");
  const model = await getModelFromConfig(config, {
    temperature: 0,
  });
  const modelWithTool = model.withStructuredOutput(
    z.object({
      route: z
        .enum(["replyToGeneralInput", artifactRoute])
        .describe("Маршрут для выполнения на основе запроса пользователя."),
    }),
    {
      name: "route_query",
    }
  );

  logger.debug("Invoking model for routing decision");
  const result = await modelWithTool.invoke([
    {
      role: "user",
      content: formattedPrompt,
    },
  ]);

  logger.info("Path generation complete", { selectedRoute: result.route });
  return {
    next: result.route,
  };
};

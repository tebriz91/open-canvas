import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { OpenCanvasGraphAnnotation } from "../../state";
import {
  formatArtifactContent,
  getModelConfig,
  getModelFromConfig,
} from "@/agent/utils";
import { getArtifactContent } from "@/contexts/utils";
import { GET_TITLE_TYPE_REWRITE_ARTIFACT } from "../../prompts";
import { OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA } from "./schemas";
import { ToolCall } from "@langchain/core/messages/tool";
import { getFormattedReflections } from "../../../utils";
import { HumanMessage } from "@langchain/core/messages";
import logger from "@/lib/logger";

export async function optionallyUpdateArtifactMeta(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<ToolCall | undefined> {
  logger.info("Starting artifact metadata update process");

  const { modelProvider } = getModelConfig(config);
  logger.debug("Model configuration", { modelProvider });

  const toolCallingModel = (await getModelFromConfig(config))
    .bindTools(
      [
        {
          name: "optionallyUpdateArtifactMeta",
          schema: OPTIONALLY_UPDATE_ARTIFACT_META_SCHEMA,
          description: "Обновляет мета-информацию артефакта, если необходимо.",
        },
      ],
      {
        // Ollama does not support tool choice
        ...(modelProvider !== "ollama" && {
          tool_choice: "optionallyUpdateArtifactMeta",
        }),
      }
    )
    .withConfig({ runName: "optionally_update_artifact_meta" });
  logger.debug("Model initialized and bound with metadata update tool");

  const memoriesAsString = await getFormattedReflections(config);
  logger.debug("Retrieved formatted reflections", {
    memoriesLength: memoriesAsString.length,
  });

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    logger.error("No artifact found for metadata update");
    throw new Error("No artifact found");
  }
  logger.debug("Retrieved current artifact content", {
    title: currentArtifactContent.title,
    type: currentArtifactContent.type,
    contentLength: currentArtifactContent.fullMarkdown?.length || 0,
  });

  const optionallyUpdateArtifactMetaPrompt =
    GET_TITLE_TYPE_REWRITE_ARTIFACT.replace(
      "{artifact}",
      formatArtifactContent(currentArtifactContent, true)
    ).replace("{reflections}", memoriesAsString);
  logger.debug("Assembled metadata update prompt", {
    promptLength: optionallyUpdateArtifactMetaPrompt.length,
  });

  let recentHumanMessage;
  // For RAG rewrite, create a synthetic human message if none exists
  if (state.customQuickActionId === "rag_rewrite") {
    recentHumanMessage = new HumanMessage({
      content:
        "Пожалуйста, обновите мета-информацию, если это необходимо, на основе полученного контекста.",
    });
    logger.debug("Created synthetic human message for RAG rewrite");
  } else {
    recentHumanMessage = state.messages.findLast(
      (message) => message.getType() === "human"
    );
    if (!recentHumanMessage) {
      logger.error("No recent human message found");
      throw new Error("No recent human message found");
    }
    logger.debug("Retrieved last human message", {
      content: recentHumanMessage.content,
    });
  }

  logger.info("Invoking model for metadata update");
  const optionallyUpdateArtifactResponse = await toolCallingModel.invoke([
    { role: "system", content: optionallyUpdateArtifactMetaPrompt },
    recentHumanMessage,
  ]);
  logger.debug("Received model response", {
    hasToolCalls: !!optionallyUpdateArtifactResponse.tool_calls,
    toolCallsCount: optionallyUpdateArtifactResponse.tool_calls?.length || 0,
  });

  const toolCall = optionallyUpdateArtifactResponse.tool_calls?.[0];
  logger.info("Completed metadata update process", {
    hasUpdates: !!toolCall,
    updatedTitle: toolCall?.args?.title,
  });

  return toolCall;
}

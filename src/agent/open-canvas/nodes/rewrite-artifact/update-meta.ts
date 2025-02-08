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

export async function optionallyUpdateArtifactMeta(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<ToolCall | undefined> {
  const { modelProvider } = getModelConfig(config);
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

  const memoriesAsString = await getFormattedReflections(config);

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }

  const optionallyUpdateArtifactMetaPrompt =
    GET_TITLE_TYPE_REWRITE_ARTIFACT.replace(
      "{artifact}",
      formatArtifactContent(currentArtifactContent, true)
    ).replace("{reflections}", memoriesAsString);

  let recentHumanMessage;
  // For RAG rewrite, create a synthetic human message if none exists
  if (state.customQuickActionId === "rag_rewrite") {
    recentHumanMessage = new HumanMessage({
      content:
        "Please update the metadata if needed based on the retrieved context.",
    });
  } else {
    recentHumanMessage = state.messages.findLast(
      (message) => message.getType() === "human"
    );
    if (!recentHumanMessage) {
      throw new Error("No recent human message found");
    }
  }

  const optionallyUpdateArtifactResponse = await toolCallingModel.invoke([
    { role: "system", content: optionallyUpdateArtifactMetaPrompt },
    recentHumanMessage,
  ]);

  return optionallyUpdateArtifactResponse.tool_calls?.[0];
}

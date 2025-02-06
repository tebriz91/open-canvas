import { NEW_ARTIFACT_PROMPT } from "../../prompts";
import { ArtifactMarkdownV3 } from "@/types";
import { ToolCall } from "@langchain/core/messages/tool";

export const formatNewArtifactPrompt = (
  memoriesAsString: string,
  modelName: string
): string => {
  return NEW_ARTIFACT_PROMPT.replace("{reflections}", memoriesAsString).replace(
    "{disableChainOfThought}",
    modelName.includes("claude")
      ? "\n\nВАЖНО: НЕ выполняйте chain of thought заранее. Сразу переходите к генерации ответа инструмента. Это ОЧЕНЬ важно."
      : ""
  );
};

export const createArtifactContent = (
  toolCall: ToolCall | undefined
): ArtifactMarkdownV3 => {
  const toolArgs = toolCall?.args;

  return {
    index: 1,
    type: "text",
    title: toolArgs?.title,
    fullMarkdown: toolArgs?.artifact,
  };
};

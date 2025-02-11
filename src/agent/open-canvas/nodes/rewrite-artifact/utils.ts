import { getArtifactContent } from "@/contexts/utils";
import { ArtifactMarkdownV3 } from "@/types";
import {
  OPTIONALLY_UPDATE_META_PROMPT,
  UPDATE_ENTIRE_ARTIFACT_PROMPT,
} from "../../prompts";
import { OpenCanvasGraphAnnotation } from "../../state";
import { ToolCall } from "@langchain/core/messages/tool";
import { HumanMessage } from "@langchain/core/messages";

export const validateState = (
  state: typeof OpenCanvasGraphAnnotation.State
) => {
  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }

  let recentHumanMessage;
  // For RAG rewrite, create a synthetic human message if none exists
  if (state.customQuickActionId === "rag_rewrite") {
    recentHumanMessage = new HumanMessage({
      content:
        "Пожалуйста, перепишите это, используя извлеченный контекст для улучшения.",
    });
  } else {
    recentHumanMessage = state.messages.findLast(
      (message) => message.getType() === "human"
    );
    if (!recentHumanMessage) {
      throw new Error("No recent human message found");
    }
  }

  return { currentArtifactContent, recentHumanMessage };
};

const buildMetaPrompt = (artifactMetaToolCall: ToolCall | undefined) => {
  const titleSection = artifactMetaToolCall?.args?.title
    ? `И его название (не включайте в свой ответ):\n${artifactMetaToolCall.args.title}`
    : "";

  return OPTIONALLY_UPDATE_META_PROMPT.replace(
    "{artifactType}",
    "text"
  ).replace("{artifactTitle}", titleSection);
};

interface BuildPromptArgs {
  artifactContent: string;
  memoriesAsString: string;
  isNewType: boolean;
  artifactMetaToolCall: ToolCall | undefined;
  context?: string;
}

/**
 * Builds the prompt for artifact rewrite.
 * Note: The context here is now produced by a legal-aware (semantic) text splitter
 * that segments legal documents into coherent sections.
 */
export const buildPrompt = ({
  artifactContent,
  memoriesAsString,
  isNewType,
  artifactMetaToolCall,
  context,
}: BuildPromptArgs) => {
  const metaPrompt = isNewType ? buildMetaPrompt(artifactMetaToolCall) : "";
  const contextPrompt = context
    ? `\n\nРелевантная информация для улучшения контента:\n${context}`
    : "";

  return UPDATE_ENTIRE_ARTIFACT_PROMPT.replace(
    "{artifactContent}",
    artifactContent
  )
    .replace("{reflections}", memoriesAsString)
    .replace("{updateMetaPrompt}", metaPrompt)
    .replace("{context}", contextPrompt);
};

interface CreateNewArtifactContentArgs {
  artifactType: string;
  state: typeof OpenCanvasGraphAnnotation.State;
  currentArtifactContent: ArtifactMarkdownV3;
  artifactMetaToolCall: ToolCall | undefined;
  newContent: string;
}

export const createNewArtifactContent = ({
  state,
  currentArtifactContent,
  artifactMetaToolCall,
  newContent,
}: CreateNewArtifactContentArgs): ArtifactMarkdownV3 => {
  const baseContent = {
    index: state.artifact.contents.length + 1,
    type: "text",
    title: artifactMetaToolCall?.args?.title || currentArtifactContent.title,
  };

  return {
    ...baseContent,
    type: "text",
    fullMarkdown: newContent,
  };
};

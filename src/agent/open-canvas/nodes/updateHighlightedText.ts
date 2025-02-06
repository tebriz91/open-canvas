import { OpenCanvasGraphAnnotation, OpenCanvasGraphReturnType } from "../state";
import { ArtifactMarkdownV3 } from "../../../types";
import { getArtifactContent } from "../../../contexts/utils";
import { isArtifactMarkdownContent } from "../../../lib/artifact_content_types";
import { getModelConfig, getModelFromConfig } from "@/agent/utils";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { RunnableBinding } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { AIMessageChunk } from "@langchain/core/messages";
import { ConfigurableChatModelCallOptions } from "langchain/chat_models/universal";

const PROMPT = `Вы - опытный AI-ассистент для юристов, которому поручено переписать выделенный пользователем текст. Выделенный текст находится внутри большего "блока". Вы всегда должны отвечать ТОЛЬКО обновленным текстовым блоком в соответствии с запросом пользователя.
Вы всегда должны отвечать полным текстовым блоком в формате Markdown, так как он просто заменит существующий блок в артефакте.
Блоки будут объединены позже, поэтому вам не нужно беспокоиться о форматировании блоков. Просто убедитесь, что вы сохраняете форматирование и структуру обновляемого блока.

# Выделенный текст
{highlightedText}

# Текстовый блок
{textBlocks}

Ваша задача - переписать текст в соответствии с запросом пользователя. Стиль Markdown был удален из выделенного текста, чтобы вы могли сосредоточиться на самом тексте.
Однако, убедитесь, что вы ВСЕГДА отвечаете полным текстовым блоком в формате Markdown, включая любой синтаксис Markdown.
НИКОГДА не оборачивайте свой ответ в дополнительный синтаксис Markdown, так как это будет обработано системой. Не включайте тройные обратные кавычки, если они не присутствовали в исходном текстовом блоке.
Вы НЕ должны изменять ничего, КРОМЕ выделенного текста. Единственный случай, когда вы можете обновить окружающий текст, - это если это необходимо, чтобы выделенный текст имел смысл.
Вы ВСЕГДА должны отвечать полным, обновленным текстовым блоком, включая любое форматирование, например, новые строки, отступы, синтаксис Markdown и т.д. НИКОГДА не добавляйте дополнительный синтаксис или форматирование, если пользователь специально не запросил это.
Если вы видите частичный Markdown, это НОРМАЛЬНО, потому что вы обновляете только часть текста.

Убедитесь, что вы отвечаете ПОЛНЫМ текстовым блоком, включая обновленный выделенный текст. НИКОГДА не включайте только обновленный выделенный текст или дополнительные префиксы или суффиксы.`;

/**
 * Update an existing artifact based on the user's query.
 */
export const updateHighlightedText = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const { modelProvider } = getModelConfig(config);
  let model: RunnableBinding<
    BaseLanguageModelInput,
    AIMessageChunk,
    ConfigurableChatModelCallOptions
  >;
  if (modelProvider.includes("openai")) {
    // Custom model is OpenAI/Azure OpenAI
    model = (
      await getModelFromConfig(config, {
        temperature: 0,
      })
    ).withConfig({ runName: "update_highlighted_markdown" });
  } else {
    // Custom model is not set to OpenAI/Azure OpenAI. Use GPT-4o
    model = (
      await getModelFromConfig(
        {
          ...config,
          configurable: {
            customModelName: "gpt-4o",
          },
        },
        {
          temperature: 0,
        }
      )
    ).withConfig({ runName: "update_highlighted_markdown" });
  }

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;
  if (!currentArtifactContent) {
    throw new Error("No artifact found");
  }
  if (!isArtifactMarkdownContent(currentArtifactContent)) {
    throw new Error("Artifact is not markdown content");
  }

  if (!state.highlightedText) {
    throw new Error(
      "Can not partially regenerate an artifact without a highlight"
    );
  }

  const { markdownBlock, selectedText, fullMarkdown } = state.highlightedText;
  const formattedPrompt = PROMPT.replace(
    "{highlightedText}",
    selectedText
  ).replace("{textBlocks}", markdownBlock);

  const recentUserMessage = state.messages[state.messages.length - 1];
  if (recentUserMessage.getType() !== "human") {
    throw new Error("Expected a human message");
  }

  const response = await model.invoke([
    {
      role: "system",
      content: formattedPrompt,
    },
    recentUserMessage,
  ]);
  const responseContent = response.content as string;

  const newCurrIndex = state.artifact.contents.length + 1;
  const prevContent = state.artifact.contents.find(
    (c) => c.index === state.artifact.currentIndex && c.type === "text"
  ) as ArtifactMarkdownV3 | undefined;
  if (!prevContent) {
    throw new Error("Previous content not found");
  }

  if (!fullMarkdown.includes(markdownBlock)) {
    throw new Error("Selected text not found in current content");
  }
  const newFullMarkdown = fullMarkdown.replace(markdownBlock, responseContent);

  const updatedArtifactContent: ArtifactMarkdownV3 = {
    ...prevContent,
    index: newCurrIndex,
    fullMarkdown: newFullMarkdown,
  };

  return {
    artifact: {
      ...state.artifact,
      currentIndex: newCurrIndex,
      contents: [...state.artifact.contents, updatedArtifactContent],
    },
  };
};

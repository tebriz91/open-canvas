import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getModelFromConfig } from "../../utils";
import { getArtifactContent } from "../../../contexts/utils";
import { Reflections } from "../../../types";
import {
  ensureStoreInConfig,
  formatArtifactContentWithTemplate,
  formatReflections,
} from "../../utils";
import { CURRENT_ARTIFACT_PROMPT, NO_ARTIFACT_PROMPT } from "../prompts";
import { OpenCanvasGraphAnnotation, OpenCanvasGraphReturnType } from "../state";

/**
 * Generate responses to questions. Does not generate artifacts.
 */
export const replyToGeneralInput = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const smallModel = await getModelFromConfig(config);

  const prompt = `Вы - AI ассистент, которому поручено отвечать на вопросы пользователей.
  
В прошлом пользователь сгенерировал артефакты. Используйте следующие артефакты в качестве контекста при ответе на вопрос пользователя.

У вас также есть следующие размышления о стилистических рекомендациях и общие воспоминания/факты о пользователе, которые следует использовать при создании ответа.
<reflections>
{reflections}
</reflections>

{currentArtifactPrompt}`;

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }
  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : "No reflections found.";

  const formattedPrompt = prompt
    .replace("{reflections}", memoriesAsString)
    .replace(
      "{currentArtifactPrompt}",
      currentArtifactContent
        ? formatArtifactContentWithTemplate(
            CURRENT_ARTIFACT_PROMPT,
            currentArtifactContent
          )
        : NO_ARTIFACT_PROMPT
    );

  const response = await smallModel.invoke([
    { role: "system", content: formattedPrompt },
    ...state.messages,
  ]);

  return {
    messages: [response],
  };
};

import { BaseStore, LangGraphRunnableConfig } from "@langchain/langgraph";
import { ArtifactMarkdownV3, Reflections } from "../types";
import { initChatModel } from "langchain/chat_models/universal";

export const formatReflections = (
  reflections: Reflections,
  extra?: {
    /**
     * Will only include the style guidelines in the output.
     * If this is set to true, you may not specify `onlyContent` as `true`.
     */
    onlyStyle?: boolean;
    /**
     * Will only include the content in the output.
     * If this is set to true, you may not specify `onlyStyle` as `true`.
     */
    onlyContent?: boolean;
  }
): string => {
  if (extra?.onlyStyle && extra?.onlyContent) {
    throw new Error(
      "Cannot specify both `onlyStyle` and `onlyContent` as true."
    );
  }

  let styleRulesArr = reflections.styleRules;
  let styleRulesStr = "Руководства по стилю не найдены.";
  if (!Array.isArray(styleRulesArr)) {
    try {
      styleRulesArr = JSON.parse(styleRulesArr);

      styleRulesStr = styleRulesArr.join("\n- ");
    } catch (_) {
      console.error(
        "FAILED TO PARSE STYLE RULES. \n\ntypeof:",
        typeof styleRulesArr,
        "\n\nstyleRules:",
        styleRulesArr
      );
    }
  }

  let contentRulesArr = reflections.content;
  let contentRulesStr = "Воспоминания/факты не найдены.";

  if (!Array.isArray(contentRulesArr)) {
    try {
      contentRulesArr = JSON.parse(contentRulesArr);
      contentRulesStr = contentRulesArr.join("\n- ");
    } catch (_) {
      console.error(
        "FAILED TO PARSE CONTENT RULES. \n\ntypeof:",
        typeof contentRulesArr,
        "\ncontentRules:",
        contentRulesArr
      );
    }
  }

  const styleString = `Следующий список содержит руководства по стилю, которые вы ранее генерировали:
<style-guidelines>
- ${styleRulesStr}
</style-guidelines>`;

  const contentString = `Следующий список содержит воспоминания/факты, которые вы ранее генерировали о пользователе:
<user-facts>
- ${contentRulesStr}
</user-facts>`;

  if (extra?.onlyStyle) {
    return styleString;
  }
  if (extra?.onlyContent) {
    return contentString;
  }

  return styleString + "\n\n" + contentString;
};

export async function getFormattedReflections(
  config: LangGraphRunnableConfig
): Promise<string> {
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

  return memoriesAsString;
}

export const ensureStoreInConfig = (
  config: LangGraphRunnableConfig
): BaseStore => {
  if (!config.store) {
    throw new Error("`store` not found in config");
  }
  return config.store;
};

export const formatArtifactContent = (
  content: ArtifactMarkdownV3,
  shortenContent?: boolean
): string => {
  const artifactContent = shortenContent
    ? content.fullMarkdown?.slice(0, 500)
    : content.fullMarkdown;
  return `Title: ${content.title}\nArtifact type: ${content.type}\nContent: ${artifactContent}`;
};

export const formatArtifactContentWithTemplate = (
  template: string,
  content: ArtifactMarkdownV3,
  shortenContent?: boolean
): string => {
  return template.replace(
    "{artifact}",
    formatArtifactContent(content, shortenContent)
  );
};

export const getModelConfig = (
  config: LangGraphRunnableConfig
): {
  modelName: string;
  modelProvider: string;
  azureConfig?: {
    azureOpenAIApiKey: string;
    azureOpenAIApiInstanceName: string;
    azureOpenAIApiDeploymentName: string;
    azureOpenAIApiVersion: string;
    azureOpenAIBasePath?: string;
  };
  apiKey?: string;
  baseUrl?: string;
} => {
  const customModelName = config.configurable?.customModelName as string;
  if (!customModelName) {
    throw new Error("Model name is missing in config.");
  }

  if (customModelName.startsWith("azure/")) {
    const actualModelName = customModelName.replace("azure/", "");
    return {
      modelName: actualModelName,
      modelProvider: "azure_openai",
      azureConfig: {
        azureOpenAIApiKey: process.env._AZURE_OPENAI_API_KEY || "",
        azureOpenAIApiInstanceName:
          process.env._AZURE_OPENAI_API_INSTANCE_NAME || "",
        azureOpenAIApiDeploymentName:
          process.env._AZURE_OPENAI_API_DEPLOYMENT_NAME || "",
        azureOpenAIApiVersion:
          process.env._AZURE_OPENAI_API_VERSION || "2024-08-01-preview",
        azureOpenAIBasePath: process.env._AZURE_OPENAI_API_BASE_PATH,
      },
    };
  }

  if (customModelName.includes("gpt-")) {
    return {
      modelName: customModelName,
      modelProvider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
  if (customModelName.includes("claude-")) {
    return {
      modelName: customModelName,
      modelProvider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }
  if (customModelName.includes("fireworks/")) {
    return {
      modelName: customModelName,
      modelProvider: "fireworks",
      apiKey: process.env.FIREWORKS_API_KEY,
    };
  }
  if (customModelName.includes("gemini-")) {
    return {
      modelName: customModelName,
      modelProvider: "google-genai",
      apiKey: process.env.GOOGLE_API_KEY,
    };
  }
  if (customModelName.startsWith("ollama-")) {
    return {
      modelName: customModelName.replace("ollama-", ""),
      modelProvider: "ollama",
      baseUrl:
        process.env.OLLAMA_API_URL || "http://host.docker.internal:11434",
    };
  }

  throw new Error("Unknown model provider");
};

export function optionallyGetSystemPromptFromConfig(
  config: LangGraphRunnableConfig
): string | undefined {
  return config.configurable?.systemPrompt as string | undefined;
}

export async function getModelFromConfig(
  config: LangGraphRunnableConfig,
  extra?: {
    temperature?: number;
    maxTokens?: number;
  }
) {
  const { temperature = 0.5, maxTokens } = extra || {};
  const { modelName, modelProvider, azureConfig, apiKey, baseUrl } =
    getModelConfig(config);

  return await initChatModel(modelName, {
    modelProvider,
    maxTokens,
    temperature,
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiKey ? { apiKey } : {}),
    ...(azureConfig != null
      ? {
          azureOpenAIApiKey: azureConfig.azureOpenAIApiKey,
          azureOpenAIApiInstanceName: azureConfig.azureOpenAIApiInstanceName,
          azureOpenAIApiDeploymentName:
            azureConfig.azureOpenAIApiDeploymentName,
          azureOpenAIApiVersion: azureConfig.azureOpenAIApiVersion,
          azureOpenAIBasePath: azureConfig.azureOpenAIBasePath,
        }
      : {}),
  });
}

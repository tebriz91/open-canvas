import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getModelFromConfig } from "@/agent/utils";
import { ARTIFACT_TOOL_SCHEMA } from "../generate-artifact/schemas";
import { createArtifactContent } from "../generate-artifact/utils";
import { addDocumentsToVectorStore } from "@/rag/vector_store";
import { Document } from "@langchain/core/documents";
import logger from "@/lib/logger";

export const rewriteArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const model = await getModelFromConfig(config, {
    temperature: 0.5,
  });

  const modelWithArtifactTool = model.bindTools([
    {
      name: "generate_artifact",
      schema: ARTIFACT_TOOL_SCHEMA,
    },
  ]);

  const systemPrompt = `Ты эксперт по переписыванию и улучшению документов. Твоя задача - переписать и улучшить текущий документ на основе предоставленного контекста и запроса пользователя.

Контекст, полученный из поиска (RAG), для переписывания:
${state.context || "Нет дополнительного контекста."}

Исходный документ для переписывания:
${state.artifact?.contents[state.artifact.currentIndex - 1]?.fullMarkdown || ""}`;

  logger.debug("Rewrite Artifact System Prompt", { prompt: systemPrompt });

  try {
    const response = await modelWithArtifactTool.invoke(
      [
        {
          role: "system",
          content: systemPrompt,
        },
        ...state.messages,
      ],
      { runName: "rewrite_artifact" }
    );
    logger.debug("Rewrite Artifact Model Response", { response });

    const newArtifactContent = createArtifactContent(response.tool_calls?.[0]);

    if (!state.artifact) {
      throw new Error("No artifact to rewrite");
    }

    const newContents = [...state.artifact.contents];
    newContents.push(newArtifactContent);

    const newArtifact = {
      ...state.artifact,
      currentIndex: newContents.length,
      contents: newContents,
    };

    // Update the vector store with the rewritten content
    try {
      logger.info("Adding rewritten artifact to vector store", {
        title: newArtifactContent.title,
        contentLength: newArtifactContent.fullMarkdown?.length || 0,
        version: newContents.length,
      });

      const document = new Document({
        pageContent: newArtifactContent.fullMarkdown || "",
        metadata: {
          ...state.artifact.metadata,
          version: newContents.length,
          source: "rewritten_artifact",
          artifact_id: state.artifact.id,
        },
      });

      await addDocumentsToVectorStore([document]);

      logger.info("Successfully added rewritten artifact to vector store", {
        title: newArtifactContent.title,
        version: newContents.length,
      });
    } catch (error) {
      logger.error("Failed to add rewritten artifact to vector store", {
        error: error instanceof Error ? error.message : String(error),
        title: newArtifactContent.title,
        version: newContents.length,
      });
      // Continue even if vector store update fails - Review if this is always desired behavior
    }

    return {
      artifact: newArtifact,
    };
  } catch (error) {
    logger.error("Error rewriting artifact", {
      error: error instanceof Error ? error.message : String(error),
      prompt: systemPrompt,
    });
    throw error;
  }
};

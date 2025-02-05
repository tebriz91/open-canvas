import { cleanContent } from "@/lib/normalize_string";
import {
  Artifact,
  ArtifactMarkdownV3,
  ArtifactToolResponse,
  ArtifactV3,
  RewriteArtifactMetaToolResponse,
} from "@/types";
import {
  AIMessage,
  BaseMessage,
  BaseMessageChunk,
} from "@langchain/core/messages";
import { parsePartialJson } from "@langchain/core/output_parsers";

export function removeCodeBlockFormatting(text: string): string {
  if (!text) return text;
  // Regular expression to match code blocks
  const codeBlockRegex = /^```[\w-]*\n([\s\S]*?)\n```$/;

  // Check if the text matches the code block pattern
  const match = text.match(codeBlockRegex);

  if (match) {
    // If it matches, return the content inside the code block
    return match[1].trim();
  } else {
    // If it doesn't match, return the original text
    return text;
  }
}

export const replaceOrInsertMessageChunk = (
  prevMessages: BaseMessage[],
  newMessageChunk: BaseMessageChunk
): BaseMessage[] => {
  const existingMessageIndex = prevMessages.findIndex(
    (msg) => msg.id === newMessageChunk.id
  );

  if (
    prevMessages[existingMessageIndex]?.content &&
    typeof prevMessages[existingMessageIndex]?.content !== "string"
  ) {
    throw new Error("Message content is not a string");
  }
  if (typeof newMessageChunk.content !== "string") {
    throw new Error("Message chunk content is not a string");
  }

  if (existingMessageIndex !== -1) {
    // Create a new array with the updated message
    return [
      ...prevMessages.slice(0, existingMessageIndex),
      new AIMessage({
        ...prevMessages[existingMessageIndex],
        content:
          (prevMessages[existingMessageIndex]?.content || "") +
          (newMessageChunk?.content || ""),
      }),
      ...prevMessages.slice(existingMessageIndex + 1),
    ];
  } else {
    const newMessage = new AIMessage({
      ...newMessageChunk,
    });
    return [...prevMessages, newMessage];
  }
};

export const createNewGeneratedArtifactFromTool = (
  artifactTool: ArtifactToolResponse
): ArtifactMarkdownV3 | undefined => {
  if (!artifactTool.type) {
    console.error("Received new artifact without type");
    return;
  }
  if (artifactTool.type === "text") {
    return {
      index: 1,
      type: "text",
      title: artifactTool.title || "",
      fullMarkdown: artifactTool.artifact || "",
    };
  }
};

const validateNewArtifactIndex = (
  newArtifactIndexGuess: number,
  prevArtifactContentsLength: number,
  isFirstUpdate: boolean
): number => {
  if (isFirstUpdate) {
    // For first updates, currentIndex should be one more than the total prev contents
    // to append the new content at the end
    if (newArtifactIndexGuess !== prevArtifactContentsLength + 1) {
      return prevArtifactContentsLength + 1;
    }
  } else {
    if (newArtifactIndexGuess !== prevArtifactContentsLength) {
      // For subsequent updates, currentIndex should match the total contents
      // to update the latest content in place
      return prevArtifactContentsLength;
    }
  }
  // If the guess is correct, return the guess
  return newArtifactIndexGuess;
};

export const updateHighlightedMarkdown = (
  prevArtifact: ArtifactV3,
  content: string,
  newArtifactIndex: number,
  prevCurrentContent: ArtifactMarkdownV3,
  isFirstUpdate: boolean
): ArtifactV3 | undefined => {
  // Create a deep copy of the previous artifact
  const basePrevArtifact = {
    ...prevArtifact,
    contents: prevArtifact.contents.map((c) => ({ ...c })),
  };

  const currentIndex = validateNewArtifactIndex(
    newArtifactIndex,
    basePrevArtifact.contents.length,
    isFirstUpdate
  );

  let newContents: ArtifactMarkdownV3[];

  if (isFirstUpdate) {
    const newMarkdownContent: ArtifactMarkdownV3 = {
      ...prevCurrentContent,
      index: currentIndex,
      fullMarkdown: content,
    };
    newContents = [...basePrevArtifact.contents, newMarkdownContent];
  } else {
    newContents = basePrevArtifact.contents.map((c) => {
      if (c.index === currentIndex) {
        return {
          ...c,
          fullMarkdown: content,
        };
      }
      return { ...c }; // Create new reference for unchanged items too
    });
  }

  // Create new reference for the entire artifact
  const newArtifact: ArtifactV3 = {
    ...basePrevArtifact,
    currentIndex,
    contents: newContents,
  };

  // Verify we're actually creating a new reference
  if (Object.is(newArtifact, prevArtifact)) {
    console.warn("Warning: updateHighlightedMarkdown returned same reference");
  }

  return newArtifact;
};

interface UpdateRewrittenArtifactArgs {
  prevArtifact: ArtifactV3;
  newArtifactContent: string;
  rewriteArtifactMeta: RewriteArtifactMetaToolResponse;
  prevCurrentContent?: ArtifactMarkdownV3;
  newArtifactIndex: number;
  isFirstUpdate: boolean;
}

export const updateRewrittenArtifact = ({
  prevArtifact,
  newArtifactContent,
  rewriteArtifactMeta,
  prevCurrentContent,
  newArtifactIndex,
  isFirstUpdate,
}: UpdateRewrittenArtifactArgs): ArtifactV3 => {
  // Create a deep copy of the previous artifact
  const basePrevArtifact = {
    ...prevArtifact,
    contents: prevArtifact.contents.map((c) => ({ ...c })),
  };

  const currentIndex = validateNewArtifactIndex(
    newArtifactIndex,
    basePrevArtifact.contents.length,
    isFirstUpdate
  );

  let artifactContents: ArtifactMarkdownV3[];

  if (isFirstUpdate) {
    artifactContents = [
      ...basePrevArtifact.contents,
      {
        index: currentIndex,
        type: "text",
        title: rewriteArtifactMeta?.title ?? prevCurrentContent?.title ?? "",
        fullMarkdown: newArtifactContent,
      },
    ];
  } else {
    artifactContents = basePrevArtifact.contents.map((c) => {
      if (c.index === currentIndex) {
        return {
          ...c,
          fullMarkdown: newArtifactContent,
        };
      }
      return { ...c }; // Create new reference for unchanged items too
    });
  }

  const newArtifact: ArtifactV3 = {
    ...basePrevArtifact,
    currentIndex,
    contents: artifactContents,
  };

  // Verify we're actually creating a new reference
  if (Object.is(newArtifact, prevArtifact)) {
    console.warn("Warning: updateRewrittenArtifact returned same reference");
  }

  return newArtifact;
};

export const convertToArtifactV3 = (oldArtifact: Artifact): ArtifactV3 => {
  let currentIndex = oldArtifact.currentContentIndex;
  if (currentIndex > oldArtifact.contents.length) {
    // If the value to be set in `currentIndex` is greater than the total number of contents,
    // set it to the last index so that the user can see the latest content.
    currentIndex = oldArtifact.contents.length;
  }

  const v3: ArtifactV3 = {
    currentIndex,
    contents: oldArtifact.contents.map((content) => {
      return {
        index: content.index,
        type: "text",
        title: content.title,
        fullMarkdown: content.content,
        blocks: undefined,
      };
    }),
  };
  return v3;
};

export const getArtifactContent = (
  artifact: ArtifactV3
): ArtifactMarkdownV3 => {
  if (!artifact) {
    throw new Error("No artifact found.");
  }
  const currentContent = artifact.contents.find(
    (a) => a.index === artifact.currentIndex
  );
  if (!currentContent) {
    return artifact.contents[artifact.contents.length - 1];
  }
  return currentContent;
};

export function handleGenerateArtifactToolCallChunk(toolCallChunkArgs: string) {
  let newArtifactText: ArtifactToolResponse | undefined = undefined;

  // Attempt to parse the tool call chunk.
  try {
    newArtifactText = parsePartialJson(toolCallChunkArgs);
    if (!newArtifactText) {
      throw new Error("Failed to parse new artifact text");
    }
    newArtifactText = {
      ...newArtifactText,
      title: newArtifactText.title ?? "",
      type: newArtifactText.type ?? "",
    };
  } catch (_) {
    return "continue";
  }

  if (newArtifactText.artifact && newArtifactText.type === "text") {
    const content = createNewGeneratedArtifactFromTool(newArtifactText);
    if (!content) {
      return undefined;
    }
    if (content.type === "text") {
      content.fullMarkdown = cleanContent(content.fullMarkdown);
    }

    return {
      currentIndex: 1,
      contents: [content],
    };
  }
}

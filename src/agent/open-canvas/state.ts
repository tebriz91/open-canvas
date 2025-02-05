import {
  ArtifactLengthOptions,
  LanguageOptions,
  ReadingLevelOptions,
  ArtifactV3,
  TextHighlight,
} from "../../types";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const OpenCanvasGraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  /**
   * The highlighted text. This includes the markdown blocks which the highlighted
   * text belongs to, along with the entire plain text content of highlight.
   */
  highlightedText: Annotation<TextHighlight | undefined>,
  /**
   * The artifacts that have been generated in the conversation.
   */
  artifact: Annotation<ArtifactV3>,
  /**
   * The next node to route to. Only used for the first routing node/conditional edge.
   */
  next: Annotation<string | undefined>,
  /**
   * The language to translate the artifact to.
   */
  language: Annotation<LanguageOptions | undefined>,
  /**
   * The length of the artifact to regenerate to.
   */
  artifactLength: Annotation<ArtifactLengthOptions | undefined>,
  /**
   * Whether or not to regenerate with emojis.
   */
  regenerateWithEmojis: Annotation<boolean | undefined>,
  /**
   * The reading level to adjust the artifact to.
   */
  readingLevel: Annotation<ReadingLevelOptions | undefined>,
  /**
   * The ID of the custom quick action to use.
   */
  customQuickActionId: Annotation<string | undefined>,
});

export type OpenCanvasGraphReturnType = Partial<
  typeof OpenCanvasGraphAnnotation.State
>;

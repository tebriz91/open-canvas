import { END, Send, START, StateGraph } from "@langchain/langgraph";
import { DEFAULT_INPUTS } from "../../constants";
import { customAction } from "./nodes/customAction";
import { generateArtifact } from "./nodes/generate-artifact";
import { generateFollowup } from "./nodes/generateFollowup";
import { generatePath } from "./nodes/generatePath";
import { reflectNode } from "./nodes/reflect";
import { rewriteArtifact } from "./nodes/rewrite-artifact";
import { rewriteArtifactTheme } from "./nodes/rewriteArtifactTheme";
import { replyToGeneralInput } from "./nodes/replyToGeneralInput";
import { generateTitleNode } from "./nodes/generateTitle";
import { updateHighlightedText } from "./nodes/updateHighlightedText";
import { OpenCanvasGraphAnnotation } from "./state";
import { ragRetrievalNode } from "./nodes/ragRetrieval";
import logger from "../../lib/logger";

const routeNode = (state: typeof OpenCanvasGraphAnnotation.State) => {
  if (!state.next) {
    logger.error("'next' state field not set in routeNode");
    throw new Error("'next' state field not set.");
  }

  logger.info(`Routing to next node: ${state.next}`, {
    currentState: state,
    nextNode: state.next,
  });

  return new Send(state.next, {
    ...state,
  });
};

const cleanState = (_: typeof OpenCanvasGraphAnnotation.State) => {
  logger.debug("Cleaning state, resetting to default inputs");
  return {
    ...DEFAULT_INPUTS,
  };
};

/**
 * Conditionally route to the "generateTitle" node if there are only
 * two messages in the conversation. This node generates a concise title
 * for the conversation which is displayed in the thread history.
 */
const conditionallyGenerateTitle = (
  state: typeof OpenCanvasGraphAnnotation.State
) => {
  const messageCount = state.messages.length;
  logger.info(
    `Checking if title generation is needed. Message count: ${messageCount}`
  );

  if (messageCount > 2) {
    logger.debug(
      "Skipping title generation - conversation already has more than 2 messages"
    );
    return END;
  }
  logger.info("Initiating title generation for new conversation");
  return "generateTitle";
};

const builder = new StateGraph(OpenCanvasGraphAnnotation)
  // Start node & edge
  .addNode("generatePath", generatePath)
  .addEdge(START, "generatePath")
  // Nodes
  .addNode("replyToGeneralInput", replyToGeneralInput)
  .addNode("rewriteArtifact", rewriteArtifact)
  .addNode("rewriteArtifactTheme", rewriteArtifactTheme)
  .addNode("updateHighlightedText", updateHighlightedText)
  .addNode("generateArtifact", generateArtifact)
  .addNode("customAction", customAction)
  .addNode("generateFollowup", generateFollowup)
  .addNode("cleanState", cleanState)
  .addNode("reflect", reflectNode)
  .addNode("generateTitle", generateTitleNode)
  .addNode("ragRetrieval", ragRetrievalNode)
  // Initial router
  .addConditionalEdges("generatePath", routeNode, [
    "rewriteArtifactTheme",
    "replyToGeneralInput",
    "generateArtifact",
    "rewriteArtifact",
    "customAction",
    "updateHighlightedText",
    "ragRetrieval",
  ])
  // Edges
  .addEdge("generateArtifact", "generateFollowup")
  .addEdge("updateHighlightedText", "generateFollowup")
  .addEdge("rewriteArtifact", "generateFollowup")
  .addEdge("rewriteArtifactTheme", "generateFollowup")
  .addEdge("customAction", "generateFollowup")
  .addEdge("ragRetrieval", "rewriteArtifact")
  // End edges
  .addEdge("replyToGeneralInput", "cleanState")
  // Only reflect if an artifact was generated/updated.
  .addEdge("generateFollowup", "reflect")
  .addEdge("reflect", "cleanState")
  .addConditionalEdges("cleanState", conditionallyGenerateTitle, [
    END,
    "generateTitle",
  ])
  .addEdge("generateTitle", END);

export const graph = builder.compile().withConfig({ runName: "open_canvas" });

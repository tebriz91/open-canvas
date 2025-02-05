"use client";

import { ArtifactRenderer } from "@/components/artifacts/ArtifactRenderer";
import { ContentComposerChatInterface } from "./content-composer";
import { ALL_MODEL_NAMES } from "@/constants";
import { cn } from "@/lib/utils";
import {
  ArtifactMarkdownV3,
  ArtifactV3,
} from "@/types";
import { useEffect, useState } from "react";
import { useGraphContext } from "@/contexts/GraphContext";
import React from "react";

export function CanvasComponent() {
  const { threadData, graphData, userData } = useGraphContext();
  const { user } = userData;
  const { threadId, clearThreadsWithNoValues, setModelName } = threadData;
  const { setArtifact } = graphData;
  const [chatStarted, setChatStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!threadId || !user) return;
    // Clear threads with no values
    clearThreadsWithNoValues(user.id);
  }, [threadId, user, clearThreadsWithNoValues]);

  const handleQuickStart = (
    type: "text" ,
  ) => {
    setChatStarted(true);

    const artifactContent: ArtifactMarkdownV3 = {
      index: 1,
      type: "text",
      title: `Quick start ${type}`,
      fullMarkdown: "",
    };

    const newArtifact: ArtifactV3 = {
      currentIndex: 1,
      contents: [artifactContent],
    };
    // Do not worry about existing items in state. This should
    // never occur since this action can only be invoked if
    // there are no messages/artifacts in the thread.
    setArtifact(newArtifact);
    setIsEditing(true);
  };

  return (
    <main className="h-screen flex flex-row">
      <div
        className={cn(
          "transition-all duration-700",
          chatStarted ? "w-[35%]" : "w-full",
          "h-full mr-auto bg-gray-50/70 shadow-inner-right"
        )}
      >
        <ContentComposerChatInterface
          switchSelectedThreadCallback={(thread) => {
            // Chat should only be "started" if there are messages present
            if ((thread.values as Record<string, any>)?.messages?.length) {
              setChatStarted(true);
              setModelName(
                thread?.metadata?.customModelName as ALL_MODEL_NAMES
              );
            } else {
              setChatStarted(false);
            }
          }}
          setChatStarted={setChatStarted}
          hasChatStarted={chatStarted}
          handleQuickStart={handleQuickStart}
        />
      </div>
      {chatStarted && (
        <div className="w-full ml-auto">
          <ArtifactRenderer setIsEditing={setIsEditing} isEditing={isEditing} />
        </div>
      )}
    </main>
  );
}

export const Canvas = React.memo(CanvasComponent);

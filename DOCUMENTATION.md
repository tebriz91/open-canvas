# Open Canvas Documentation

## Project Overview

Open Canvas is an open-source web application for collaborating with agents to better write documents. It provides an interactive canvas where users can work with AI to create and edit both text and code content.

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/UI
- **State Management**: React Context (GraphContext)
- **Authentication**: Supabase
- **AI Integration**: LangChain, LangGraph

## Key Features

- Real-time collaboration with AI agents
- Support for both text and code editing
- Memory system for personalized interactions
- Custom quick actions
- Artifact versioning
- Live markdown rendering

## Project Structure

```md
src/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication routes
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── artifacts/         # Artifact rendering components
│   ├── auth/             # Authentication components
│   ├── canvas/           # Main canvas components
│   ├── chat-interface/   # Chat UI components
│   └── ui/               # Reusable UI components
├── contexts/             # React contexts
├── hooks/               # Custom React hooks
├── lib/                # Utility functions
├── agent/              # AI agent configuration
└── types/              # TypeScript type definitions
```

## Core Components

### Canvas

The main container component that orchestrates the entire application.

Reference:

```tsx
// 19:110:src/components/canvas/canvas.tsx
export function CanvasComponent() {
  const { threadData, graphData, userData } = useGraphContext();
  const { user } = userData;
  const { threadId, clearThreadsWithNoValues, setModelName } = threadData;
  const { setArtifact } = graphData;
  const { toast } = useToast();
  const [chatStarted, setChatStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!threadId || !user) return;
    // Clear threads with no values
    clearThreadsWithNoValues(user.id);
  }, [threadId, user]);

  const handleQuickStart = (
    type: "text" | "code",
    language?: ProgrammingLanguageOptions
  ) => {
    if (type === "code" && !language) {
      toast({
        title: "Language not selected",
        description: "Please select a language to continue",
        duration: 5000,
      });
      return;
    }
    setChatStarted(true);

    let artifactContent: ArtifactCodeV3 | ArtifactMarkdownV3;
    if (type === "code" && language) {
      artifactContent = {
        index: 1,
        type: "code",
        title: `Quick start ${type}`,
        code: getLanguageTemplate(language),
        language,
      };
    } else {
      artifactContent = {
        index: 1,
        type: "text",
        title: `Quick start ${type}`,
        fullMarkdown: "",
      };
    }

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
```

Key responsibilities:

- Manages the chat interface and artifact renderer layout
- Handles quick start actions for new documents
- Controls the editing state of artifacts
- Manages model selection and thread management

### GraphContext

The central state management system that handles:

- Artifact state management
- Message handling
- Real-time updates
- Thread management

Reference:

```tsx
// 110:185:src/contexts/GraphContext.tsx
export function GraphProvider({ children }: { children: ReactNode }) {
  const userData = useUser();
  const threadData = useThread();
  const { toast } = useToast();
  const { shareRun } = useRuns();
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [artifact, setArtifact] = useState<ArtifactV3>();
  const [selectedBlocks, setSelectedBlocks] = useState<TextHighlight>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [updateRenderedArtifactRequired, setUpdateRenderedArtifactRequired] =
    useState(false);
  const lastSavedArtifact = useRef<ArtifactV3 | undefined>(undefined);
  const debouncedAPIUpdate = useRef(
    debounce(
      (artifact: ArtifactV3, threadId: string) =>
        updateArtifact(artifact, threadId),
      5000
    )
  ).current;
  const [isArtifactSaved, setIsArtifactSaved] = useState(true);
  const [threadSwitched, setThreadSwitched] = useState(false);
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [runId, setRunId] = useState<string>();
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    if (userData.user) return;
    userData.getUser();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userData.user) return;

    if (!threadData.threadId) {
      threadData.searchOrCreateThread(userData.user.id);
    }

    if (!threadData.assistantId) {
      threadData.getOrCreateAssistant();
    }
  }, [userData.user]);

  useEffect(() => {
    if (typeof window === "undefined" || !userData.user) return;
    addAssistantIdToUser();
  }, [userData.user]);

  useEffect(() => {
    if (typeof window === "undefined" || !userData.user) return;
    addAssistantIdToUser();
  }, [userData.user]);

  // Very hacky way of ensuring updateState is not called when a thread is switched
  useEffect(() => {
    if (threadSwitched) {
      const timer = setTimeout(() => {
        setThreadSwitched(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [threadSwitched]);

  useEffect(() => {
    return () => {
      debouncedAPIUpdate.cancel();
    };
  }, [debouncedAPIUpdate]);

  useEffect(() => {
    if (!threadData.threadId) return;
    if (!messages.length || !artifact) return;
    if (updateRenderedArtifactRequired || threadSwitched || isStreaming) return;
    const currentIndex = artifact.currentIndex;
    const currentContent = artifact.contents.find(
      (c) => c.index === currentIndex
    );
    if (!currentContent) return;
    if (
      (artifact.contents.length === 1 &&
        artifact.contents[0].type === "text" &&
        !artifact.contents[0].fullMarkdown) ||
      (artifact.contents[0].type === "code" && !artifact.contents[0].code)
    ) {
      // If the artifact has only one content and it's empty, we shouldn't update the state
      return;
    }
///...
```

## Documentation Plan

1. **Component Documentation**
   - Create a `components/README.md` file
   - Document each major component's purpose and props
   - Include usage examples

2. **Type System Documentation**
   - Document key types and interfaces
   - Explain the artifact system structure
   - Document state management types

3. **Setup Guide**
   - Update environment configuration documentation
   - Document local development setup
   - Add troubleshooting guides

4. **Code Style Guide**
   - Document coding conventions
   - Add ESLint and Prettier configuration explanations
   - Include component organization guidelines

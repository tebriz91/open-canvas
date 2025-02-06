# Open Canvas Documentation

## Project Overview

Open Canvas is an open-source web application for collaborating with agents to better write documents. It provides an interactive canvas where users can work with AI to create and edit text content.

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
- Support for text editing and markdown
- Memory system for personalized interactions
- Custom quick actions
- Artifact versioning
- Live markdown rendering

## Project Structure

```md
src/
├── app/ # Next.js app directory
│ ├── api/
│ ├── auth/ # Authentication routes
│ ├── globals.css # Global styles
│ └── layout.tsx # Root layout
├── components/ # React components
│ ├── artifacts/ # Artifact rendering components
│ ├── auth/ # Authentication components
│ ├── canvas/ # Main canvas components
│ ├── chat-interface/ # Chat UI components
│ └── ui/ # Reusable UI components
├── contexts/ # React contexts
├── hooks/ # Custom React hooks
├── lib/ # Utility functions
├── agent/ # AI agent configuration
└── types/ # TypeScript type definitions
```

## Key components and flow of the system:

### Authentication Flow

The authentication is handled through Supabase, with middleware checking each request:

```ts
// src/lib/supabase/middleware.ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

When a user logs in, the flow goes through:

```ts
// src/app/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    console.log("Exchanging code for session with code:", code);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host"); // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        console.log(
          "Code exchange successful, redirecting to:",
          `${origin}${next}`
        );
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        console.log(
          "Code exchange successful, redirecting to:",
          `https://${forwardedHost}${next}`
        );
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        console.log(
          "Code exchange successful, redirecting to:",
          `${origin}${next}`
        );
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      console.error("Code exchange failed:", error);
    }
  }

  // return the user to an error page with instructions
  console.error("Code exchange failed, redirecting to error page");
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
```

Key aspects:

- Session management on every request
- Exclusion of static assets from authentication
- Integration with Supabase authentication
- Automatic session refresh

### API Route Structure

The main API route handler acts as a proxy between frontend and LangGraph:

```ts
// src/app/api/[..._path]/route.ts
export async function handleRequest(req: NextRequest, method: string) {
  // 1. Verify user authentication
  const user = await verifyUserAuthenticated();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Transform request path and params
  const path = req.nextUrl.pathname.replace(/^\/?api\//, "");
  const searchParams = new URLSearchParams(url.search);

  // 3. Prepare request for LangGraph API
  const options: RequestInit = {
    method,
    headers: {
      "x-api-key": process.env.LANGCHAIN_API_KEY,
    },
  };

  // 4. Handle request body if POST/PUT/PATCH
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const bodyText = await req.text();
    if (bodyText) {
      const parsedBody = JSON.parse(bodyText);
      parsedBody.config = parsedBody.config || {};
      parsedBody.config.configurable = {
        ...parsedBody.config.configurable,
        supabase_user_id: user.id,
      };
      options.body = JSON.stringify(parsedBody);
    }
  }

  // 5. Forward to LangGraph and return response
  const res = await fetch(
    `${LANGGRAPH_API_URL}/${path}${queryString}`,
    options
  );
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: new Headers({
      ...getCorsHeaders(),
      ...res.headers,
    }),
  });
}
```

### Client and Thread Management

The system uses a client-side wrapper around the LangGraph SDK to manage communication:

```ts
// src/hooks/utils.ts
export const createClient = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
  return new Client({
    apiUrl,
  });
};
```

#### Thread Management Hook (useThread)

The `useThread` hook provides thread management functionality:

```ts
// src/hooks/useThread.tsx
export function useThread() {
  // State management for threads
  const [threadId, setThreadId] = useState<string>();
  const [userThreads, setUserThreads] = useState<Thread[]>([]);
  const [modelName, setModelName] =
    useState<ALL_MODEL_NAMES>(DEFAULT_MODEL_NAME);

  // Key functionalities:
  // 1. Create new threads
  // 2. Fetch user's threads
  // 3. Clean up empty threads
  // 4. Delete threads
  // 5. Thread search and retrieval
}
```

Key features:

- Thread creation with model selection
- User-specific thread management
- Automatic cleanup of empty threads
- Thread search and deletion capabilities
- Cookie-based thread ID persistence

#### Store Management Hook (useStore)

The `useStore` hook handles persistent storage operations:

```ts
// src/hooks/useStore.tsx
export function useStore() {
  // Manages:
  // 1. Reflections storage
  // 2. Custom quick actions
  // 3. User preferences
  // Key operations:
  // - Get/Delete reflections
  // - Manage custom quick actions (CRUD)
  // - Handle loading states
}
```

Features:

- Namespace-based storage organization
- Assistant-specific reflection storage
- Custom quick actions management
- Error handling and loading states

### Frontend State Management

The GraphContext manages frontend state and communication:

```tsx
// src/contexts/GraphContext.tsx
interface GraphData {
  runId: string | undefined;
  isStreaming: boolean;
  selectedBlocks: TextHighlight | undefined;
  messages: BaseMessage[];
  artifact: ArtifactV3 | undefined;
  updateRenderedArtifactRequired: boolean;
  isArtifactSaved: boolean;
  firstTokenReceived: boolean;
  feedbackSubmitted: boolean;
  setFeedbackSubmitted: Dispatch<SetStateAction<boolean>>;
  setArtifact: Dispatch<SetStateAction<ArtifactV3 | undefined>>;
  setSelectedBlocks: Dispatch<SetStateAction<TextHighlight | undefined>>;
  setSelectedArtifact: (index: number) => void;
  setMessages: Dispatch<SetStateAction<BaseMessage[]>>;
  streamMessage: (params: GraphInput) => Promise<void>;
  setArtifactContent: (index: number, content: string) => void;
  clearState: () => void;
  switchSelectedThread: (thread: Thread) => void;
  setUpdateRenderedArtifactRequired: Dispatch<SetStateAction<boolean>>;
}
```

### Streaming Response Handling

The streaming response from LangGraph is processed in chunks:

```tsx
// src/contexts/GraphContext.tsx
const streamMessageV2 = async (params: GraphInput) => {
  // ... validation checks ...

  const client = createClient();
  const input = {
    ...DEFAULT_INPUTS,
    artifact,
    ...params,
    ...(selectedBlocks && {
      highlightedText: selectedBlocks,
    }),
  };

  // ... input validation ...

  setIsStreaming(true);
  let runId = "";
  let followupMessageId = "";

  try {
    const stream = client.runs.stream(
      threadData.threadId,
      assistantsData.selectedAssistant.assistant_id,
      {
        input,
        streamMode: "events",
        config: {
          configurable: {
            customModelName: threadData.modelName,
          },
        },
      }
    );

    // ... state tracking variables ...

    for await (const chunk of stream) {
      try {
        // Track run ID
        if (!runId && chunk.data?.metadata?.run_id) {
          runId = chunk.data.metadata.run_id;
          setRunId(runId);
        }

        if (chunk.data.event === "on_chat_model_stream") {
          // Handle different node types:
          // - Generate new messages
          // - Generate artifacts
          // - Update highlighted text
          // - Update artifacts
          // - Rewrite artifacts
          // - Handle theme changes
          // ... specific node handling logic ...
        }

        if (chunk.data.event === "on_chat_model_end") {
          // Handle completion events
          // ... completion logic ...
        }
      } catch (e) {
        console.error("Failed to parse stream chunk", e);
      }
    }
  } catch (e) {
    console.error("Failed to stream message", e);
  } finally {
    setSelectedBlocks(undefined);
    setIsStreaming(false);
  }

  // Share run if completed successfully
  if (runId) {
    shareRun(runId).then(async (sharedRunURL) => {
      // Update messages with run URL
      // ... message update logic ...
    });
  }
};
```

- Validate inputs and setup client
- Initialize streaming connection
- Process stream chunks:
  - Track run ID
  - Handle different node types
  - Update UI state based on events
- Share run results when complete
- Clean up state

### Store Operations

Separate routes handle store operations:

```ts
// src/app/api/store/put/route.ts
export async function POST(req: NextRequest) {
  let user: User | undefined;
  try {
    console.log("User authentication started");
    user = await verifyUserAuthenticated();
    if (!user) {
      console.error("User authentication failed: Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("User authentication successful for user:", user.id);
  } catch (e) {
    console.error("Failed to fetch user", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { namespace, key, value } = await req.json();

  const lgClient = new Client({
    apiKey: process.env.LANGCHAIN_API_KEY,
    apiUrl: LANGGRAPH_API_URL,
  });

  // perform store operation
  try {
    console.log("Putting item with key:", key, "into namespace:", namespace);
    await lgClient.store.putItem(namespace, key, value);
    console.log("Item put successfully for key:", key);

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to put item:", error);
    return new NextResponse(JSON.stringify({ error: "Failed to put item." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

The flow works like this:

- Frontend makes request through GraphContext
- Request goes through Next.js middleware for auth check
- API route validates user and transforms request
- Request forwarded to LangGraph
- Response streamed back through API route
- Frontend updates state based on streamed response

### Frontend Canvas Architecture

The canvas is the main interface component that manages the interaction between the chat interface and markdown rendering:

```tsx
// src/components/canvas/canvas.tsx
export function CanvasComponent() {
  // Main layout with dynamic width adjustment
  return (
    <main className="h-screen flex flex-row">
      <div
        className={cn(
          "transition-all duration-700",
          chatStarted ? "w-[35%]" : "w-full",
          "h-full mr-auto bg-gray-50/70 shadow-inner-right"
        )}
      >
        <ContentComposerChatInterface />
      </div>
      {chatStarted && (
        <div className="w-full ml-auto">
          <ArtifactRenderer />
        </div>
      )}
    </main>
  );
}
```

Key features:

- Split view layout with dynamic resizing
- Smooth transitions between states
- Integrated chat and markdown rendering
- Quick start functionality for text documents

#### Content Composer

The content composer manages the chat interface and message handling:

```tsx
// src/components/canvas/content-composer.tsx
export function ContentComposerChatInterface() {
  // Handles new message creation and streaming
  async function onNew(message: AppendMessage): Promise<void> {
    // Convert and stream messages
    const humanMessage = new HumanMessage({
      content: message.content[0].text,
      id: uuidv4(),
    });

    setMessages((prevMessages) => [...prevMessages, humanMessage]);
    await streamMessage({
      messages: [convertToOpenAIFormat(humanMessage)],
    });
  }

  // Runtime integration with external message converter
  const threadMessages = useExternalMessageConverter<BaseMessage>({
    callback: convertLangchainMessages,
    messages: messages,
    isRunning,
  });
}
```

Features:

- Real-time message streaming
- Message format conversion
- Thread management
- Quick start templates
- Integration with LangChain messages

## API Architecture and Data Flow

### API Layer Overview

The application uses a multi-layered API architecture:

1. **Frontend Client Layer** (`src/hooks/utils.ts`)
   ```typescript
   // Client creation with automatic API routing
   export const createClient = () => {
     const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
     return new Client({ apiUrl });
   };
   ```

2. **Next.js API Proxy Layer** (`src/app/api/[..._path]/route.ts`)
   - Acts as a secure middleware between frontend and LangGraph
   - Handles authentication and request transformation
   - Adds user context to requests
   - Manages CORS and error handling

3. **LangGraph Backend Layer**
   - Handles AI model interactions
   - Manages thread and assistant state
   - Provides persistent storage

### Request Flow

Here's how a typical request flows through the system:

1. **Frontend Initialization**
   ```typescript
   // Create client instance
   const client = createClient();
   
   // Make API request (e.g., create thread)
   const thread = await client.threads.create({
     metadata: {
       supabase_user_id: userId,
       customModelName: "gpt-4"
     }
   });
   ```

2. **Next.js API Processing**
   ```typescript
   // 1. Authentication check
   const user = await verifyUserAuthenticated();
   
   // 2. Request transformation
   const path = req.nextUrl.pathname.replace(/^\/?api\//, "");
   
   // 3. Add user context
   const options = {
     method,
     headers: { "x-api-key": process.env.LANGCHAIN_API_KEY },
     body: JSON.stringify({
       ...parsedBody,
       config: {
         configurable: {
           supabase_user_id: user.id,
           ...parsedBody.config?.configurable
         }
       }
     })
   };
   
   // 4. Forward to LangGraph
   const res = await fetch(`${LANGGRAPH_API_URL}/${path}`, options);
   ```

3. **Response Handling**
   - Responses are streamed back through the same layers
   - Frontend updates state based on streamed events
   - Error handling at each layer

### Key Components and Their Interactions

#### Thread Management

```typescript
// Frontend hook (useThread)
export function useThread() {
  // State management
  const [threadId, setThreadId] = useState<string>();
  const [userThreads, setUserThreads] = useState<Thread[]>([]);

  // Thread creation with API interaction
  const createThread = async (customModelName, userId) => {
    const client = createClient();
    const thread = await client.threads.create({
      metadata: { supabase_user_id: userId, customModelName }
    });
    // Update local state and cookies
    setThreadId(thread.thread_id);
    setCookie(THREAD_ID_COOKIE_NAME, thread.thread_id);
  };
}
```

#### Streaming Response Processing

```typescript
// Handle streaming responses from LangGraph
const streamMessage = async (params: GraphInput) => {
  const stream = client.runs.stream(threadId, assistantId, {
    input,
    streamMode: "events",
    config: { configurable: { customModelName } }
  });

  for await (const chunk of stream) {
    // Process different event types
    if (chunk.data.event === "on_chat_model_stream") {
      // Handle streaming message content
    }
    if (chunk.data.event === "on_chat_model_end") {
      // Handle completion
    }
  }
};
```

### Store Operations

The application includes a key-value store system for persistent data:

1. **Store API Routes**
   ```typescript
   // PUT operation
   export async function POST(req: NextRequest) {
     const user = await verifyUserAuthenticated();
     const { namespace, key, value } = await req.json();
     
     const lgClient = new Client({
       apiKey: process.env.LANGCHAIN_API_KEY,
       apiUrl: LANGGRAPH_API_URL
     });
     
     await lgClient.store.putItem(namespace, key, value);
   }
   ```

2. **Store Usage**
   - Manages reflections storage
   - Handles custom quick actions
   - Stores user preferences
   - Organizes data by namespaces

### Security Considerations

1. **Authentication**
   - Every request is authenticated via Supabase
   - API keys are never exposed to frontend
   - Session management through middleware

2. **Request Transformation**
   - User context added server-side
   - Request validation before forwarding
   - Error handling and logging

3. **CORS and Headers**
   - Proper CORS headers for cross-origin requests
   - Secure header handling and validation

### Error Handling

Each layer includes comprehensive error handling:

1. **Frontend Layer**
   - Catches and logs API errors
   - Provides user feedback
   - Handles retry logic where appropriate

2. **API Proxy Layer**
   - Validates requests and user authentication
   - Transforms error responses
   - Maintains detailed error logging

3. **Response Processing**
   - Handles stream interruptions
   - Processes partial responses
   - Manages state recovery

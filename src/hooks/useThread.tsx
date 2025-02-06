import {
  ALL_MODEL_NAMES,
  DEFAULT_MODEL_NAME,
  HAS_EMPTY_THREADS_CLEARED_COOKIE,
  THREAD_ID_COOKIE_NAME,
} from "@/constants";
import { getCookie, setCookie } from "@/lib/cookies";
import { Thread } from "@langchain/langgraph-sdk";
import { useState } from "react";
import { createClient } from "./utils";

export function useThread() {
  const [threadId, setThreadId] = useState<string>();
  const [userThreads, setUserThreads] = useState<Thread[]>([]);
  const [isUserThreadsLoading, setIsUserThreadsLoading] = useState(false);
  const [modelName, setModelName] =
    useState<ALL_MODEL_NAMES>(DEFAULT_MODEL_NAME);

  /**
   * Creates a new thread with specified model and user ID
   * 
   * Example:
   * ```typescript
   * // Create a thread with default model
   * const thread = await createThread(DEFAULT_MODEL_NAME, "user_123");
   * 
   * // Create a thread with specific model
   * const thread = await createThread("gpt-4", "user_123");
   * ```
   * 
   * The function will:
   * 1. Create a thread via LangGraph API
   * 2. Store thread ID in state and cookies
   * 3. Update model name in state
   * 4. Refresh user's thread list
   * 
   * @param customModelName - The AI model to use (e.g., "gpt-4", "gpt-3.5-turbo")
   * @param userId - Supabase user ID for thread ownership
   * @returns Created thread object or undefined if creation fails
   */
  const createThread = async (
    customModelName: ALL_MODEL_NAMES = DEFAULT_MODEL_NAME,
    userId: string
  ): Promise<Thread | undefined> => {
    // Initialize LangGraph client
    const client = createClient();
    
    try {
      console.log(
        "Creating thread with customModelName:",
        customModelName,
        "for userId:",
        userId
      );

      // Create thread with metadata
      // Example request body:
      // {
      //   "metadata": {
      //     "supabase_user_id": "user_123",
      //     "customModelName": "gpt-4"
      //   }
      // }
      const thread = await client.threads.create({
        metadata: {
          supabase_user_id: userId,
          customModelName,
        },
      });

      // Store thread ID in state and cookies for persistence
      // Example thread.thread_id: "thread_abc123"
      setThreadId(thread.thread_id);
      setCookie(THREAD_ID_COOKIE_NAME, thread.thread_id);
      
      // Update model name in state for UI
      setModelName(customModelName);
      
      // Refresh thread list to include new thread
      await getUserThreads(userId);
      
      console.log(
        "Thread created successfully with threadId:",
        thread.thread_id
      );
      return thread;
    } catch (e) {
      console.error("Failed to create thread", e);
    }
  };

  const getOrCreateAssistant = async () => {
    const assistantIdCookie = getCookie(ASSISTANT_ID_COOKIE);
    if (assistantIdCookie) {
      setAssistantId(assistantIdCookie);
      return;
    }
    const client = createClient();
    try {
      console.log("Creating assistant");
      const assistant = await client.assistants.create({
        graphId: "agent",
      });
      setAssistantId(assistant.assistant_id);
      setCookie(ASSISTANT_ID_COOKIE, assistant.assistant_id);
      console.log(
        "Assistant created successfully with assistantId:",
        assistant.assistant_id
      );
    } catch (e) {
      console.error("Failed to create assistant", e);
    }
  };

  const getUserThreads = async (userId: string) => {
    setIsUserThreadsLoading(true);
    try {
      console.log("Retrieving user threads for userId:", userId);
      const client = createClient();

      const userThreads = await client.threads.search({
        metadata: {
          supabase_user_id: userId,
        },
        limit: 100,
      });

      if (userThreads.length > 0) {
        const lastInArray = userThreads[0];
        const allButLast = userThreads.slice(1, userThreads.length);
        const filteredThreads = allButLast.filter(
          (thread) => thread.values && Object.keys(thread.values).length > 0
        );
        setUserThreads([...filteredThreads, lastInArray]);
        console.log("User threads retrieved successfully for userId:", userId);
      }
    } catch (e) {
      console.error("Failed to retrieve user threads", e);
    } finally {
      setIsUserThreadsLoading(false);
    }
  };

  const searchOrCreateThread = async (userId: string) => {
    const threadIdCookie = getCookie(THREAD_ID_COOKIE_NAME);
    if (!threadIdCookie) {
      await createThread(modelName, userId);
      return;
    }

    // Thread ID is in cookies.
    const thread = await getThreadById(threadIdCookie);
    if (
      thread &&
      (!thread?.values || Object.keys(thread.values).length === 0)
    ) {
      // No values = no activity. Can keep.
      setThreadId(threadIdCookie);
      return threadIdCookie;
    } else {
      // Current thread has activity. Create a new thread.
      await createThread(modelName, userId);
      return;
    }
  };

  const clearThreadsWithNoValues = async (userId: string) => {
    const hasBeenClearedCookie = getCookie(HAS_EMPTY_THREADS_CLEARED_COOKIE);
    if (hasBeenClearedCookie === "true") {
      return;
    }

    const client = createClient();
    const processedThreadIds = new Set<string>();

    const fetchAndDeleteThreads = async (offset = 0) => {
      const userThreads = await client.threads.search({
        metadata: {
          supabase_user_id: userId,
        },
        limit: 100,
        offset: offset,
      });

      const threadsToDelete = userThreads.filter(
        (thread) =>
          !thread.values &&
          thread.thread_id !== threadId &&
          !processedThreadIds.has(thread.thread_id)
      );

      if (threadsToDelete.length > 0) {
        const deleteBatch = async (threadIds: string[]) => {
          await Promise.all(
            threadIds.map(async (threadId) => {
              await client.threads.delete(threadId);
              processedThreadIds.add(threadId);
            })
          );
        };

        // Create an array of unique thread IDs
        const uniqueThreadIds = Array.from(
          new Set(threadsToDelete.map((thread) => thread.thread_id))
        );

        // Process unique thread IDs in batches of 10
        for (let i = 0; i < uniqueThreadIds.length; i += 10) {
          try {
            await deleteBatch(uniqueThreadIds.slice(i, i + 10));
          } catch (e) {
            console.error("Error deleting threads", e);
          }
        }
      }

      if (userThreads.length === 100) {
        // If we got 100 threads, there might be more, so continue fetching
        await fetchAndDeleteThreads(offset + 100);
      }
    };

    try {
      console.log("Clearing threads with no values for userId:", userId);
      await fetchAndDeleteThreads();
      setCookie(HAS_EMPTY_THREADS_CLEARED_COOKIE, "true");
      console.log(
        "Threads with no values cleared successfully for userId:",
        userId
      );
    } catch (e) {
      console.error("Error fetching & deleting threads", e);
    }
  };

  const getThreadById = async (id: string): Promise<Thread | undefined> => {
    try {
      console.log("Retrieving thread with ID:", id);
      const client = createClient();
      const thread = await client.threads.get(id);
      if (thread.metadata && thread.metadata.customModelName) {
        setModelName(thread.metadata.customModelName as ALL_MODEL_NAMES);
      }
      console.log("Thread retrieved successfully with ID:", id);
      return thread;
    } catch (e) {
      console.error(`Failed to get thread with ID ${id}`, e);
    }
  };

  const deleteThread = async (
    id: string,
    userId: string,
    clearMessages: () => void
  ) => {
    setUserThreads((prevThreads) => {
      const newThreads = prevThreads.filter(
        (thread) => thread.thread_id !== id
      );
      return newThreads;
    });
    if (id === threadId) {
      clearMessages();
      // Create a new thread. Use .then to avoid blocking the UI.
      // Once completed, `createThread` will re-fetch all user
      // threads to update UI.
      void createThread(modelName, userId);
    }
    const client = createClient();
    try {
      console.log("Deleting thread with ID:", id);
      await client.threads.delete(id);
      console.log("Thread deleted successfully with ID:", id);
    } catch (e) {
      console.error(`Failed to delete thread with ID ${id}`, e);
    }
  };

  return {
    threadId,
    userThreads,
    isUserThreadsLoading,
    modelName,
    createThread,
    clearThreadsWithNoValues,
    searchOrCreateThread,
    getUserThreads,
    deleteThread,
    getThreadById,
    setThreadId,
    setModelName,
  };
}

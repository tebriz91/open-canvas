// This file provides utility functions for creating and configuring the LangGraph client

import { Client } from "@langchain/langgraph-sdk";

/**
 * Creates and configures a LangGraph client instance
 *
 * Example usage:
 * ```typescript
 * const client = createClient();
 *
 * // Create a thread
 * const thread = await client.threads.create({
 *   metadata: {
 *     supabase_user_id: "user_123",
 *     customModelName: "gpt-4"
 *   }
 * });
 *
 * // Search threads
 * const threads = await client.threads.search({
 *   metadata: { supabase_user_id: "user_123" },
 *   limit: 10
 * });
 * ```
 *
 * @returns {Client} Configured LangGraph client instance
 *
 * The client will use one of these base URLs:
 * - Production: Value from NEXT_PUBLIC_API_URL env variable
 * - Development: http://localhost:3000/api
 *
 * All requests from this client will be routed through the Next.js API routes,
 * which add authentication and user context before forwarding to LangGraph.
 */
export const createClient = () => {
  // Get API URL from environment variable or fallback to localhost
  // Example URLs:
  // - Production: https://your-domain.com/api
  // - Development: http://localhost:3000/api
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

  // Create new client instance pointing to our Next.js API route
  return new Client({
    apiUrl,
  });
};

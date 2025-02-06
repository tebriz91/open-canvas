import { LANGGRAPH_API_URL } from "../../../constants";
import { NextRequest, NextResponse } from "next/server";
import { User } from "@supabase/supabase-js";
import { verifyUserAuthenticated } from "../../../lib/supabase/verify_user_server";

function getCorsHeaders() {
  // Example CORS headers that allow all origins and methods
  // These headers enable cross-origin requests from any domain
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

async function handleRequest(req: NextRequest, method: string) {
  let user: User | undefined;
  try {
    user = await verifyUserAuthenticated();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } catch (e) {
    console.error("Failed to fetch user", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Extract the path and query params, remove the /api prefix
    // and remove the _path and nxtP_path query params
    // Example:
    // Input URL: /api/graphs/123/nodes?_path=graphs%2F123%2Fnodes&page=1
    // Resulting path: graphs/123/nodes
    // Resulting queryString: ?page=1
    const path = req.nextUrl.pathname.replace(/^\/?api\//, "");
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete("_path");
    searchParams.delete("nxtP_path");
    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    // Prepare request for LangGraph API
    // Example:
    // For a request to /api/threads/create with API key "sk-123..."
    // options will be:
    // {
    //   method: "POST",
    //   headers: {
    //     "x-api-key": "sk-123..."
    //   }
    // }
    const options: RequestInit = {
      method,
      headers: {
        "x-api-key": process.env.LANGCHAIN_API_KEY || "",
      },
    };

    // Handle request methods that include a body (POST, PUT, PATCH)
    // Example:
    // Input body: { "name": "My Thread" }
    // Modified body: {
    //   "name": "My Thread",
    //   "config": {
    //     "configurable": {
    //       "supabase_user_id": "user_123"
    //     }
    //   }
    // }
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const bodyText = await req.text();

      // if body exists, parse and modify it
      if (typeof bodyText === "string" && bodyText.length > 0) {
        const parsedBody = JSON.parse(bodyText);
        // ensure config object exists
        parsedBody.config = parsedBody.config || {};
        // add user ID to configurable settings
        parsedBody.config.configurable = {
          ...parsedBody.config.configurable,
          supabase_user_id: user.id,
        };
        options.body = JSON.stringify(parsedBody);
      } else {
        options.body = bodyText; // use raw body if empty/invalid
      }
    }

    // Forward request to LangGraph API with constructed path and options
    // Example:
    // If LANGGRAPH_API_URL is "https://api.langgraph.com"
    // and path is "threads/create" with queryString "?name=test"
    // Final URL will be: "https://api.langgraph.com/threads/create?name=test"
    const res = await fetch(
      `${LANGGRAPH_API_URL}/${path}${queryString}`,
      options // pass along method and body
    );

    if (res.status >= 400) {
      console.error("ERROR IN PROXY", res.status, res.statusText);
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
      });
    }

    const headers = new Headers({
      ...getCorsHeaders(),
    });
    // Safely add headers from the original response
    // Example: If the LangGraph API returns headers:
    // {
    //   "content-type": "application/json",
    //   "x-request-id": "req_123"
    // }
    // These will be merged with CORS headers
    res.headers.forEach((value, key) => {
      try {
        headers.set(key, value);
      } catch (error) {
        console.warn(`Failed to set header: ${key}`, error);
      }
    });
    // construct and return the final response to frontend
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } catch (e: any) {
    console.error("Error in proxy");
    console.error(e);
    console.error("\n\n\nEND ERROR\n\n");
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// HTTP Method Handlers
// Examples of how different HTTP methods are handled:

// GET - For retrieving data
// Example: GET /api/threads/123
// Calls handleRequest(req, "GET")
export const GET = (req: NextRequest) => handleRequest(req, "GET");

// POST - For creating new resources
// Example: POST /api/threads/create
// Body: { "name": "New Thread" }
// Calls handleRequest(req, "POST")
export const POST = (req: NextRequest) => handleRequest(req, "POST");

// PUT - For replacing resources
// Example: PUT /api/threads/123
// Body: { "name": "Updated Thread" }
// Calls handleRequest(req, "PUT")
export const PUT = (req: NextRequest) => handleRequest(req, "PUT");

// PATCH - For partial updates
// Example: PATCH /api/threads/123
// Body: { "metadata": { "tag": "important" } }
// Calls handleRequest(req, "PATCH")
export const PATCH = (req: NextRequest) => handleRequest(req, "PATCH");

// DELETE - For removing resources
// Example: DELETE /api/threads/123
// Calls handleRequest(req, "DELETE")
export const DELETE = (req: NextRequest) => handleRequest(req, "DELETE");

// OPTIONS - For CORS preflight requests
// Example: OPTIONS /api/threads/123
// Returns 204 No Content with CORS headers
export const OPTIONS = () => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(),
    },
  });
};

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@langchain/langgraph-sdk";
import { LANGGRAPH_API_URL } from "@/constants";
import { User } from "@supabase/supabase-js";
import { verifyUserAuthenticated } from "../../../../lib/supabase/verify_user_server";

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

  const { namespace, key } = await req.json();

  const lgClient = new Client({
    apiKey: process.env.LANGCHAIN_API_KEY,
    apiUrl: LANGGRAPH_API_URL,
  });

  try {
    console.log("Retrieving item with key:", key, "from namespace:", namespace);
    const item = await lgClient.store.getItem(namespace, key);
    console.log("Item retrieved successfully for key:", key);

    return new NextResponse(JSON.stringify({ item }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to retrieve item:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to retrieve item." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

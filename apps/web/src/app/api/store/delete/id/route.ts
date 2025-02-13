import { NextRequest, NextResponse } from "next/server";
import { Client } from "@langchain/langgraph-sdk";
import { LANGGRAPH_API_URL } from "@/constants";
import { verifyUserAuthenticated } from "../../../../../lib/supabase/verify_user_server";

export async function POST(req: NextRequest) {
  try {
<<<<<<< HEAD:src/app/api/store/delete/id/route.ts
    console.log("User authentication started");
    user = await verifyUserAuthenticated();
    if (!user) {
      console.error("User authentication failed: Unauthorized");
=======
    const authRes = await verifyUserAuthenticated();
    if (!authRes?.user) {
>>>>>>> dd0a0049a648517173a740716381f16c3c1a01d3:apps/web/src/app/api/store/delete/id/route.ts
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("User authentication successful for user:", user.id);
  } catch (e) {
    console.error("Failed to fetch user", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { namespace, key, id } = await req.json();

  const lgClient = new Client({
    apiKey: process.env.LANGCHAIN_API_KEY,
    apiUrl: LANGGRAPH_API_URL,
  });

  try {
    console.log("Deleting item with id:", id, "from namespace:", namespace);
    const currentItems = await lgClient.store.getItem(namespace, key);
    if (!currentItems?.value) {
      console.error("Item not found for id:", id);
      return new NextResponse(
        JSON.stringify({
          error: "Item not found",
          success: false,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const newValues = Object.fromEntries(
      Object.entries(currentItems.value).filter(([k]) => k !== id)
    );

    await lgClient.store.putItem(namespace, key, newValues);
    console.log("Item deleted successfully for id:", id);

    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to delete item:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to delete item." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

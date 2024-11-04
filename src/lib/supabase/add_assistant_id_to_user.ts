import { getCookie, setCookie } from "../cookies";
import {
  ASSISTANT_ID_COOKIE,
  HAS_ASSISTANT_COOKIE_BEEN_SET,
} from "@/constants";
import { createSupabaseClient } from "./client";

/**
 * Function which searches for the `oc_assistant_id_v2` in cookies and if so, it adds it to the user object.
 * This way we can start to add resiliency to adding/retrieving reflections in a way that is not dependent on cookies.
 */
export async function addAssistantIdToUser(): Promise<void> {
  const hasCookieBeenSet = getCookie(HAS_ASSISTANT_COOKIE_BEEN_SET);
  if (hasCookieBeenSet === "true") {
    console.log("Assistant ID cookie has already been set.");
    return;
  }
  const assistantIdCookie = getCookie(ASSISTANT_ID_COOKIE);
  if (!assistantIdCookie) {
    console.log("No assistant ID cookie found.");
    return;
  }

  try {
    const supabase = createSupabaseClient();
    console.log("Attempting to update user with assistant ID:", assistantIdCookie);
    // add ID to user data
    const { error } = await supabase.auth.updateUser({
      data: {
        reflections_id: assistantIdCookie,
      },
    });
    if (error) {
      throw new Error("Failed to update user with reflection ID.");
    }
    // If successful, set cookie to true
    setCookie(HAS_ASSISTANT_COOKIE_BEEN_SET, "true");
    console.log("User updated successfully with assistant ID:", assistantIdCookie);
  } catch (error) {
    console.error("Failed to update user with reflection ID:", error);
  }
}

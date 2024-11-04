import { User } from "@supabase/supabase-js";
import { createClient } from "./server";

export async function verifyUserAuthenticated(): Promise<User | undefined> {
  const supabase = createClient();
  console.log("Verifying user authentication");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    console.log("User authentication successful for user:", user.id);
  } else {
    console.error("User authentication failed: No user found");
  }
  return user || undefined;
}

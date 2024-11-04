import { useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

export function useUser() {
  const [user, setUser] = useState<User>();
  const [loading, setLoading] = useState(true);

  async function getUser() {
    if (user) {
      setLoading(false);
      return;
    }

    const supabase = createSupabaseClient();

    try {
      console.log("Retrieving user");
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser();
      setUser(supabaseUser || undefined);
      console.log("User retrieved successfully:", supabaseUser?.id);
    } catch (error) {
      console.error("Failed to retrieve user:", error);
    } finally {
      setLoading(false);
    }
  }

  return {
    getUser,
    user,
    loading,
  };
}

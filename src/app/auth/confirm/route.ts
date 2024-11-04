import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { redirect, RedirectType } from "next/navigation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");

  const supabase = createClient();

  if (token_hash && type) {
    console.log("Verifying OTP with token_hash:", token_hash, "and type:", type);
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      console.log("OTP verification successful, redirecting to:", next);
      // redirect user to specified redirect URL or root of app
      revalidatePath(next);
      redirect(next, RedirectType.push);
    } else {
      console.error("OTP verification failed:", error);
    }
  } else if (code) {
    console.log("Exchanging code for session with code:", code);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      console.log("Code exchange successful, redirecting to:", next);
      // redirect user to specified redirect URL or root of app
      revalidatePath(next);
      redirect(next, RedirectType.push);
    } else {
      console.error("Code exchange failed:", error);
    }
  } else {
    console.error("No valid token_hash, type, or code provided");
  }

  // redirect the user to an error page with some instructions
  console.error("Redirecting to error page");
  redirect("/error");
}

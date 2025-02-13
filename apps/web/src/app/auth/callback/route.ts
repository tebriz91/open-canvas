import { NextResponse } from "next/server";
// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";

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
        console.log("Code exchange successful, redirecting to:", `${origin}${next}`);
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        console.log("Code exchange successful, redirecting to:", `https://${forwardedHost}${next}`);
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        console.log("Code exchange successful, redirecting to:", `${origin}${next}`);
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

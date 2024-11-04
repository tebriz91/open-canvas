"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { SignupWithEmailInput } from "./Signup";

export async function signup(input: SignupWithEmailInput, baseUrl: string) {
  const supabase = createClient();

  const data = {
    email: input.email,
    password: input.password,
    // Not possible to set this when signing up with OAuth, so for now we'll omit.
    // data: {
    //   is_open_canvas: true,
    // },
    options: {
      emailRedirectTo: `${baseUrl}/auth/confirm`,
    },
  };

  console.log("Attempting to sign up user with email:", input.email);
  const { error } = await supabase.auth.signUp(data);

  if (error) {
    console.error("Signup failed for user with email:", input.email, "Error:", error);
    redirect("/auth/signup?error=true");
  }

  console.log("Signup successful for user with email:", input.email);
  // Users still need to confirm their email address.
  // This page will show a message to check their email.
  redirect("/auth/signup/success");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LoginWithEmailInput } from "./Login";

export async function login(input: LoginWithEmailInput) {
  const supabase = createClient();

  const data = {
    email: input.email,
    password: input.password,
  };

  console.log("Attempting to log in user with email:", input.email);
  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    console.error("Login failed for user with email:", input.email, "Error:", error);
    redirect("/auth/login?error=true");
  }

  console.log("Login successful for user with email:", input.email);
  revalidatePath("/", "layout");
  redirect("/");
}

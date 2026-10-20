"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }).max(254),
  password: z.string().min(1, { message: "Enter your password." }).max(256),
  next: z
    .string()
    .regex(/^\/admin(?:\/[\w\-/?=&%.]*)?$/, { message: "Invalid redirect." })
    .optional(),
});

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"email" | "password", string>>;
};

export async function signInWithPassword(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return { fieldErrors: { email: flat.email?.[0], password: flat.password?.[0] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Generic message: do not reveal whether the email exists.
    return { error: "Incorrect email or password." };
  }

  // Only active staff may enter the admin. Anyone else is signed out again.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("staff_profiles")
        .select("is_active")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: "This account does not have staff access." };
  }

  redirect(parsed.data.next ?? "/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

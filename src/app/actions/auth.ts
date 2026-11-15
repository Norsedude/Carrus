"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser, safeReturnPath } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type FormState = {
  message?: string;
  tone?: "error" | "success";
  fieldErrors: Partial<Record<string, string>>;
  values: Partial<Record<string, string>>;
};

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const email = z.email("Enter a valid email address");
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");

function errorsOf(error: z.ZodError): FormState["fieldErrors"] {
  const out: FormState["fieldErrors"] = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") }).safeParse({
    email: values.email,
    password: String(form.get("password") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: errorsOf(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { tone: "error", message: "That email and password do not match an account.", fieldErrors: {}, values };
  }
  revalidatePath("/", "layout");
  redirect(safeReturnPath(text(form, "next")));
}

export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email"), displayName: text(form, "displayName") };
  const parsed = z
    .object({ displayName: z.string().min(2, "Enter your name").max(80, "Name is too long"), email, password })
    .safeParse({ ...values, password: String(form.get("password") ?? "") });
  if (!parsed.success) return { fieldErrors: errorsOf(parsed.error), values };
  const next = safeReturnPath(text(form, "next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${serverEnv().APP_BASE_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    const exists = /already registered|already exists/i.test(error.message);
    return {
      tone: "error",
      message: exists ? "An account with this email already exists. Sign in instead." : "We could not create that account. Check the details and try again.",
      fieldErrors: {},
      values,
    };
  }
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  return { tone: "success", message: "Check your email for a link to confirm your account, then sign in.", fieldErrors: {}, values: {} };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = email.safeParse(values.email);
  if (!parsed.success) return { fieldErrors: { email: "Enter a valid email address" }, values };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${serverEnv().APP_BASE_URL}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the address has an account.
  return {
    tone: "success",
    message: "If that email has an account, a reset link is on its way. Open it in this same browser.",
    fieldErrors: {},
    values: {},
  };
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) {
    return { tone: "error", message: "This reset link is no longer valid. Request a new one.", fieldErrors: {}, values: {} };
  }
  const pw = String(form.get("password") ?? "");
  const parsed = password.safeParse(pw);
  const fieldErrors: FormState["fieldErrors"] = {};
  if (!parsed.success) fieldErrors.password = parsed.error.issues[0].message;
  if (pw !== String(form.get("confirm") ?? "")) fieldErrors.confirm = "The two passwords do not match";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values: {} };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) {
    return { tone: "error", message: "We could not change the password. Choose a different password and try again.", fieldErrors: {}, values: {} };
  }
  redirect("/account?notice=password-changed");
}

export async function updateProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  const values = { displayName: text(form, "displayName"), phone: text(form, "phone") };
  const parsed = z
    .object({
      displayName: z.string().min(2, "Enter your name").max(80, "Name is too long"),
      phone: z.string().regex(/^$|^[0-9+() .-]{7,20}$/, "Enter a phone number, for example 408-555-0101"),
    })
    .safeParse(values);
  if (!parsed.success) return { fieldErrors: errorsOf(parsed.error), values };
  const supabase = await createClient();
  // RLS limits this to the caller's own row; only name and phone are writable.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName, phone: parsed.data.phone || null })
    .eq("id", user.id);
  if (error) return { tone: "error", message: "We could not save your profile. Try again.", fieldErrors: {}, values };
  revalidatePath("/account");
  return { tone: "success", message: "Profile saved.", fieldErrors: {}, values };
}

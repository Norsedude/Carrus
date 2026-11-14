"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  forgotPasswordAction,
  loginAction,
  resetPasswordAction,
  signupAction,
  updateProfileAction,
  type FormState,
} from "@/app/actions/auth";
import { Field, Notice, btnPrimary, linkCls } from "@/components/ui";

const EMPTY: FormState = { fieldErrors: {}, values: {} };

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <Notice tone={state.tone ?? "error"}><span data-testid="form-message">{state.message}</span></Notice>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, EMPTY);
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Message state={state} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values.email} error={state.fieldErrors.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" error={state.fieldErrors.password} />
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Signing in…" : "Sign in"}</button>
      <p className="text-sm text-slate-700">
        <Link href="/forgot-password" className={linkCls}>Forgot your password?</Link>
      </p>
      <p className="text-sm text-slate-700">
        New to Carrus? <Link href={withNext("/signup")} className={linkCls}>Create an account</Link>
      </p>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signupAction, EMPTY);
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Message state={state} />
      <Field label="Your name" name="displayName" autoComplete="name" defaultValue={state.values.displayName} error={state.fieldErrors.displayName} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values.email} error={state.fieldErrors.email} />
      <Field label="Password" name="password" type="password" autoComplete="new-password" error={state.fieldErrors.password} hint="At least 8 characters." />
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="text-sm text-slate-700">
        Already have an account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className={linkCls}>Sign in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, EMPTY);
  return (
    <form action={action} noValidate className="space-y-4">
      <Message state={state} />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state.values.email} error={state.fieldErrors.email} />
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Sending…" : "Send reset link"}</button>
      <p className="text-sm text-slate-700"><Link href="/login" className={linkCls}>Back to sign in</Link></p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, EMPTY);
  return (
    <form action={action} noValidate className="space-y-4">
      <Message state={state} />
      <Field label="New password" name="password" type="password" autoComplete="new-password" error={state.fieldErrors.password} hint="At least 8 characters." />
      <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" error={state.fieldErrors.confirm} />
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Saving…" : "Change password"}</button>
    </form>
  );
}

export function ProfileForm({ displayName, phone }: { displayName: string; phone: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, { fieldErrors: {}, values: { displayName, phone } });
  return (
    <form action={action} noValidate className="space-y-4">
      <Message state={state} />
      <Field label="Name" name="displayName" autoComplete="name" defaultValue={state.values.displayName} error={state.fieldErrors.displayName} />
      <Field label="Mobile phone" name="phone" type="tel" autoComplete="tel" defaultValue={state.values.phone} error={state.fieldErrors.phone} />
      <button type="submit" disabled={pending} className={btnPrimary}>{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}

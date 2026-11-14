import type { InputHTMLAttributes, ReactNode } from "react";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
export const btnPrimary = `${btn} bg-blue-700 text-white hover:bg-blue-800`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-900 hover:bg-slate-100`;
export const btnDanger = `${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`;
export const linkCls =
  "font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-700";
export const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm " +
  "focus:border-blue-700 focus:outline-2 focus:outline-blue-700 aria-[invalid=true]:border-red-600";
export const cardCls = "rounded-xl border border-slate-200 bg-white shadow-sm";

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: { label: string; name: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = input.id ?? `f-${name}`;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        {...input}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputCls}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

const tones = {
  info: "border-blue-200 bg-blue-50 text-blue-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  error: "border-red-300 bg-red-50 text-red-900",
};

export function Notice({
  tone = "info",
  title,
  children,
  role,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div role={role ?? (tone === "error" ? "alert" : "status")} className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "blue" | "green" | "amber"; children: ReactNode }) {
  const cls = {
    neutral: "bg-slate-100 text-slate-800",
    blue: "bg-blue-100 text-blue-900",
    green: "bg-emerald-100 text-emerald-900",
    amber: "bg-amber-100 text-amber-900",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function PageShell({ title, intro, children, narrow }: { title: string; intro?: ReactNode; children: ReactNode; narrow?: boolean }) {
  return (
    <main className={`mx-auto w-full min-w-0 flex-1 px-4 py-8 sm:px-6 ${narrow ? "max-w-xl" : "max-w-6xl"}`}>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
      {intro && <p className="mt-2 max-w-3xl text-slate-700">{intro}</p>}
      <div className="mt-6">{children}</div>
    </main>
  );
}

const STATE_LABELS: Record<string, string> = {
  pending_partner: "Awaiting partner approval",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  ready_for_pickup: "Ready for pickup",
  active: "Active",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  draft: "Draft",
  pending_review: "Pending review",
  published: "Published",
  paused: "Paused",
  archived: "Archived",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Not approved",
  suspended: "Suspended",
};
export function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state;
}
export function StateBadge({ state }: { state: string }) {
  const tone = ["confirmed", "published", "verified", "active", "completed", "ready_for_pickup"].includes(state)
    ? "green"
    : ["pending_partner", "awaiting_payment", "pending_review", "pending", "draft", "paused"].includes(state)
      ? "amber"
      : "neutral";
  return <Badge tone={tone}>{stateLabel(state)}</Badge>;
}

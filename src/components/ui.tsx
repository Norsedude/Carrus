import type { InputHTMLAttributes, ReactNode } from "react";

// Brutalist-luxury primitives: pill buttons, hairline cards, generous type.
const btn =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[0.95rem] font-medium tracking-[0.01em] " +
  "transition-[background-color,color,border-color,transform,box-shadow] duration-300 ease-[var(--ease-soft)] active:scale-[0.98] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
export const btnPrimary = `${btn} bg-brand text-brand-contrast hover:bg-brand-dark hover:shadow-[var(--shadow-soft)]`;
export const btnSecondary = `${btn} border border-gray-300 bg-transparent text-gray-900 hover:border-gray-900 hover:bg-white`;
export const btnDanger = `${btn} border border-red-300 bg-transparent text-red-700 hover:bg-red-50`;
export const linkCls =
  "font-medium text-gray-900 underline decoration-gray-400 underline-offset-4 hover:decoration-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent";
export const inputCls =
  "block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[0.95rem] text-gray-900 placeholder:text-gray-500 " +
  "hover:border-gray-400 focus:border-gray-900 focus:outline-2 focus:outline-offset-1 focus:outline-accent/40 aria-[invalid=true]:border-red-600";
export const cardCls = "rounded-2xl border hairline bg-white";
export const eyebrowCls =
  "inline-flex items-center rounded-full border border-accent/40 bg-accent-soft/60 px-3 py-1 text-[0.72rem] font-medium uppercase tracking-[0.16em] text-accent";

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
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-800">
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
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-600">
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
  info: "border-accent/30 bg-accent-soft text-gray-900",
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
    <div role={role ?? (tone === "error" ? "alert" : "status")} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "blue" | "green" | "amber"; children: ReactNode }) {
  const cls = {
    neutral: "bg-gray-100 text-gray-800",
    blue: "bg-accent-soft text-accent",
    green: "bg-emerald-100 text-emerald-900",
    amber: "bg-amber-100 text-amber-900",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium tracking-wide ${cls}`}>{children}</span>;
}

export function PageShell({
  title,
  intro,
  eyebrow,
  children,
  narrow,
}: {
  title: string;
  intro?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <main className={`mx-auto w-full min-w-0 flex-1 px-4 py-10 sm:px-6 sm:py-14 ${narrow ? "max-w-xl" : "max-w-6xl"}`}>
      {eyebrow && <p className={`${eyebrowCls} mb-4`}>{eyebrow}</p>}
      <h1 className="text-4xl text-gray-900 sm:text-5xl">{title}</h1>
      {intro && <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed text-gray-600">{intro}</p>}
      <div className="mt-8">{children}</div>
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

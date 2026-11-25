import type { ReactNode } from "react";

// Re-mounted on every navigation, so each page eases in.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter flex min-w-0 flex-1 flex-col">{children}</div>;
}

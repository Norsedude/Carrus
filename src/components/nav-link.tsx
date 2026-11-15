"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Header link that marks itself active for its section. */
export function NavLink({
  href,
  match,
  className,
  activeClassName,
  children,
}: {
  href: string;
  /** Path prefixes that count as this section. */
  match: string[];
  className: string;
  activeClassName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = match.some((m) => (m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`)));
  return (
    <Link href={href} className={`${className} ${active ? activeClassName : ""}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

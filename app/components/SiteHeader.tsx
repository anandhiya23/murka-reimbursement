"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shared topbar for every Murka app. shadcn-only: ink/lime tokens, Button
// actions, responsive (labels collapse to icons on small screens).
export type HeaderAction = {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost" | "secondary";
};

export default function SiteHeader({
  subtitle,
  user,
  actions = [],
}: {
  subtitle?: string;
  user?: React.ReactNode;
  actions?: HeaderAction[];
}) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <img src="/murka-logo-dark.svg" alt="Murka" className="h-5 w-auto" />
        </Link>
        {subtitle && (
          <span className="hidden max-w-[38vw] truncate border-l pl-3 text-sm text-muted-foreground sm:inline">
            {subtitle}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {user}
          {actions.map((a) => {
            const Icon = a.icon;
            const inner = (
              <>
                {Icon && <Icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{a.label}</span>
              </>
            );
            return a.href ? (
              <Button key={a.label} asChild variant={a.variant ?? "ghost"} size="sm">
                <Link href={a.href}>{inner}</Link>
              </Button>
            ) : (
              <Button key={a.label} variant={a.variant ?? "ghost"} size="sm" onClick={a.onClick}>
                {inner}
              </Button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

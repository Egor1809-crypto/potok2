"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export function PresentationPageFrame({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const editing = Boolean(params.get("id")) || params.get("new") === "1";
  return <AppShell title="Презентации" contentWidth="full" viewportLocked={editing} desktopSidebarCollapsible contentClassName="!py-3">{children}</AppShell>;
}

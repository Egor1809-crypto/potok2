import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { EmailBuilderView } from "@/components/email-builder";

export const metadata: Metadata = { title: "Конструктор писем" };
export default function EmailBuilderPage() {
  return (
    <AppShell title="Конструктор писем" contentWidth="full" viewportLocked desktopSidebarCollapsible contentClassName="!p-2">
      <EmailBuilderView />
    </AppShell>
  );
}

import type { Metadata } from "next";
import { EmailBuilderView } from "@/components/email-builder";

export const metadata: Metadata = { title: "Конструктор писем" };
export default function EmailBuilderPage() {
  return (
    <main className="h-dvh overflow-hidden bg-background p-3 sm:p-4">
      <EmailBuilderView />
    </main>
  );
}

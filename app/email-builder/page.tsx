import type { Metadata } from "next";
import { EmailBuilderView } from "@/components/email-builder";

export const metadata: Metadata = { title: "Конструктор писем" };
export default function EmailBuilderPage() {
  return (
    <main className="fixed inset-0 h-dvh w-full overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(124,53,242,.10),transparent_28%),radial-gradient(circle_at_88%_100%,rgba(40,120,199,.08),transparent_30%),var(--background)] p-1 sm:p-2">
      <EmailBuilderView />
    </main>
  );
}

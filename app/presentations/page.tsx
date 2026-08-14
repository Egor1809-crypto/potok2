import type { Metadata } from "next";

import { AppShell } from "@/components/layout/AppShell";
import { PresentationStudio } from "@/components/presentations";

export const metadata: Metadata = { title: "Презентации" };

export default function PresentationsPage() {
  return (
    <AppShell
      title="Презентации"
      contentWidth="full"
      viewportLocked
      contentClassName="!py-4"
    >
      <PresentationStudio />
    </AppShell>
  );
}

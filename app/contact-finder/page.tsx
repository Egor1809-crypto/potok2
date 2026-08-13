import type { Metadata } from "next";

import { ContactFinderView } from "@/components/contact-finder";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = { title: "Поиск контактов" };

export default function ContactFinderPage() {
  return (
    <AppShell title="Поиск контактов" contentWidth="wide">
      <ContactFinderView />
    </AppShell>
  );
}

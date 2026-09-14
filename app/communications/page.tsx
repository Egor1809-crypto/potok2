import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CommunicationsView } from "@/components/communications/CommunicationsView";
export const metadata: Metadata = { title: "Коммуникации" };
export default function CommunicationsPage() { return <AppShell title="Коммуникации" contentWidth="full" viewportLocked contentClassName="!py-4 sm:!py-5"><CommunicationsView /></AppShell>; }

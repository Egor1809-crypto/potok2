import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CommunicationsView } from "@/components/communications/CommunicationsView";
export const metadata: Metadata = { title: "Коммуникации" };
export default function CommunicationsPage() { return <AppShell title="Коммуникации"><CommunicationsView /></AppShell>; }

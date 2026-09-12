import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { TeamManagementView } from "@/components/team/TeamManagementView";
export const metadata: Metadata = { title: "Команда и доступ" };
export default function TeamPage() { return <AppShell title="Команда"><TeamManagementView /></AppShell>; }

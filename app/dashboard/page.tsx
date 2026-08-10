import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Overview" };
export default function DashboardPage() { return <AppShell title="Overview"><DashboardView /></AppShell>; }

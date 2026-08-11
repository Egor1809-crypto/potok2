import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Обзор" };
export default function DashboardPage() { return <AppShell title="Обзор"><DashboardView /></AppShell>; }

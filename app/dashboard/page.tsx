import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = { title: "Обзор" };
export default function DashboardPage() { return <AppShell title="Обзор" contentClassName="pt-0 sm:pt-0 lg:pt-0"><DashboardView /></AppShell>; }

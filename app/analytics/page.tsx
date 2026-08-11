import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const metadata: Metadata = { title: "Результаты" };
export default function AnalyticsPage() { return <AppShell title="Результаты"><AnalyticsView /></AppShell>; }

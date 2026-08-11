import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const metadata: Metadata = { title: "Аналитика" };
export default function AnalyticsPage() { return <AppShell title="Аналитика"><AnalyticsView /></AppShell>; }

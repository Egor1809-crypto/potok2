import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";

export const metadata: Metadata = { title: "Analytics" };
export default function AnalyticsPage() { return <AppShell title="Analytics"><AnalyticsView /></AppShell>; }

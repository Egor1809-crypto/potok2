import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SegmentsView } from "@/components/segments/SegmentsView";

export const metadata: Metadata = { title: "Сегменты" };
export default function SegmentsPage() { return <AppShell title="Сегменты"><SegmentsView /></AppShell>; }

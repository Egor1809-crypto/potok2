import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SegmentsView } from "@/components/segments/SegmentsView";

export const metadata: Metadata = { title: "Segments" };
export default function SegmentsPage() { return <AppShell title="Segments"><SegmentsView /></AppShell>; }

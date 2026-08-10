import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { TemplatesView } from "@/components/templates";

export const metadata: Metadata = { title: "Templates" };
export default function TemplatesPage() { return <AppShell title="Templates"><TemplatesView /></AppShell>; }

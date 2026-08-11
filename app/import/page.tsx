import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ImportWizard } from "@/components/imports/ImportWizard";

export const metadata: Metadata = { title: "Импорт контактов" };
export default function ImportPage() { return <AppShell title="Импорт"><ImportWizard /></AppShell>; }

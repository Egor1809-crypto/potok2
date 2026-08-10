import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ImportWizard } from "@/components/imports/ImportWizard";

export const metadata: Metadata = { title: "Import contacts" };
export default function ImportPage() { return <AppShell title="Import"><ImportWizard /></AppShell>; }

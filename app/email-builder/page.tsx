import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmailBuilderView } from "@/components/email-builder";

export const metadata: Metadata = { title: "Конструктор писем" };
export default function EmailBuilderPage() {
  return <AppShell title="Конструктор писем" contentWidth="full" contentClassName="!p-3 sm:!p-4" action={<Link href="/campaigns" className="btn btn-secondary">Выйти из конструктора</Link>}><EmailBuilderView /></AppShell>;
}

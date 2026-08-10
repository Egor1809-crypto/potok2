import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { EmailBuilderView } from "@/components/email-builder";

export const metadata: Metadata = { title: "Email builder" };
export default function EmailBuilderPage() {
  return <AppShell title="Email builder" contentWidth="full" contentClassName="!p-3 sm:!p-4" action={<Link href="/campaigns" className="btn btn-secondary">Exit builder</Link>}><EmailBuilderView /></AppShell>;
}

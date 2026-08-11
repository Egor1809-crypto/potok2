import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CompaniesView } from "@/components/companies/CompaniesView";

export const metadata: Metadata = { title: "Компании" };
export default function CompaniesPage() { return <AppShell title="Компании"><CompaniesView /></AppShell>; }

import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ContactsView } from "@/components/contacts/ContactsView";

export const metadata: Metadata = { title: "Контакты" };
export default function ContactsPage() { return <AppShell title="Контакты" contentWidth="full"><ContactsView /></AppShell>; }

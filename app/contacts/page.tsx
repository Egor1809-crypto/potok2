import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ContactsView } from "@/components/contacts/ContactsView";

export const metadata: Metadata = { title: "Contacts" };
export default function ContactsPage() { return <AppShell title="Contacts" contentWidth="full"><ContactsView /></AppShell>; }

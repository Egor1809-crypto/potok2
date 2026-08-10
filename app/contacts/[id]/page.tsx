import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ContactProfileRoute } from "@/components/contacts/ContactProfileRoute";

export const metadata: Metadata = { title: "Contact profile" };
export default function ContactProfilePage() { return <AppShell title="Contact profile"><ContactProfileRoute /></AppShell>; }

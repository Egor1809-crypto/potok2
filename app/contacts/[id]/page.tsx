import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ContactProfileRoute } from "@/components/contacts/ContactProfileRoute";

export const metadata: Metadata = { title: "Профиль контакта" };
export default function ContactProfilePage() { return <AppShell title="Профиль контакта"><ContactProfileRoute /></AppShell>; }

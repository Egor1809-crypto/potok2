import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings" };
export default function SettingsPage() { return <AppShell title="Settings"><SettingsView /></AppShell>; }

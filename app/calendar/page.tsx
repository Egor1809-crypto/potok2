import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CalendarView } from "@/components/calendar";

export const metadata: Metadata = { title: "Календарь рассылок" };

export default function CalendarPage() {
  return <AppShell title="Календарь рассылок"><CalendarView /></AppShell>;
}

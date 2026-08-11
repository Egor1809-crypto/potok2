import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CampaignsView } from "@/components/campaigns";

export const metadata: Metadata = { title: "Кампании" };
export default function CampaignsPage() { return <AppShell title="Кампании"><CampaignsView /></AppShell>; }

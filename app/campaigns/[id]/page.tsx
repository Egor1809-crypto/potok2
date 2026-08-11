import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CampaignDetailRoute } from "@/components/campaigns/CampaignDetailRoute";

export const metadata: Metadata = { title: "Детали кампании" };
export default function CampaignDetailPage() { return <AppShell title="Детали кампании"><CampaignDetailRoute /></AppShell>; }

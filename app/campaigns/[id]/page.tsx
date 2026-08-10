import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { CampaignDetailRoute } from "@/components/campaigns/CampaignDetailRoute";

export const metadata: Metadata = { title: "Campaign details" };
export default function CampaignDetailPage() { return <AppShell title="Campaign details"><CampaignDetailRoute /></AppShell>; }

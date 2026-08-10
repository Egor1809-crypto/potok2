import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CampaignWizard } from "@/components/campaigns";

export const metadata: Metadata = { title: "New campaign" };
export default function NewCampaignPage() {
  return <AppShell title="New campaign" action={<Link href="/campaigns" className="btn btn-secondary">Exit wizard</Link>}><CampaignWizard /></AppShell>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { CampaignWizard } from "@/components/campaigns";

export const metadata: Metadata = { title: "Новая кампания" };
export default function NewCampaignPage() {
  return <AppShell title="Новая кампания" action={<Link href="/campaigns" className="btn btn-secondary">Выйти из мастера</Link>}><CampaignWizard /></AppShell>;
}

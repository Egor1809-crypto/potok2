import type { Metadata } from "next";

import { IntegrationsView } from "@/components/integrations";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Каналы доставки",
  description:
    "Настройка провайдеров email, Telegram и ВКонтакте для многоканальных рассылок.",
};

export default function IntegrationsPage() {
  return (
    <AppShell title="Каналы доставки">
      <IntegrationsView />
    </AppShell>
  );
}

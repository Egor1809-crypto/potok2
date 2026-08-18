"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import type {
  ApiError,
  CampaignEventRecord,
  CampaignMutationResponse,
  CampaignRecord,
  DeliveryJobRecord,
  DeliveryPlanRecord,
  WorkspaceSnapshot,
} from "@/types/api";
import { DEFAULT_TIME_ZONE, detectBrowserTimeZone } from "@/lib/client-timezone";
import { CampaignDetailView } from "./CampaignDetailView";

export function CampaignDetailRoute() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const campaignId = params?.id;
  const [campaign, setCampaign] = React.useState<CampaignRecord | null>(null);
  const [deliveryPlans, setDeliveryPlans] = React.useState<DeliveryPlanRecord[]>([]);
  const [events, setEvents] = React.useState<CampaignEventRecord[]>([]);
  const [deliveryJob, setDeliveryJob] = React.useState<DeliveryJobRecord | null>(null);
  const [apiMode, setApiMode] = React.useState<"loading" | "online" | "offline">("loading");
  const [dispatching, setDispatching] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [dispatchNotice, setDispatchNotice] = React.useState<string | null>(null);
  const [timeZone, setTimeZone] = React.useState(DEFAULT_TIME_ZONE);
  const syncedJobsRef = React.useRef(new Set<string>());

  const loadCampaign = React.useCallback(async () => {
    if (!campaignId) {
      setApiMode("offline");
      return;
    }
    setApiMode("loading");
    try {
      const response = await fetch("/api/workspace", { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Кампания недоступна");
      const body = await response.json() as WorkspaceSnapshot;
      const item = body.campaigns.find((candidate) => candidate.id === campaignId) ?? null;
      setCampaign(item);
      setTimeZone(detectBrowserTimeZone(body.workspace.timezone || DEFAULT_TIME_ZONE));
      setDeliveryPlans(body.deliveryPlans.filter((plan) => plan.campaignId === campaignId));
      setEvents(body.events.filter((event) => event.campaignId === campaignId));
      setDeliveryJob(
        body.deliveryJobs.find(
          (job) => job.campaignVersionId === item?.readyVersionId,
        ) ?? null,
      );
      setApiMode("online");
    } catch {
      setCampaign(null);
      setDeliveryPlans([]);
      setEvents([]);
      setDeliveryJob(null);
      setApiMode("offline");
    }
  }, [campaignId]);

  const dispatchCampaign = React.useCallback(async () => {
    if (!campaign?.readyVersionId) return;
    setDispatching(true);
    setDispatchNotice(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          id: campaign.id,
          action: "dispatch",
          idempotencyKey: `dispatch:${campaign.readyVersionId}`,
        }),
      });
      const body = await response.json() as CampaignMutationResponse | ApiError;
      if (!response.ok || !("campaign" in body)) {
        throw new Error("error" in body ? body.error : "Отправка не началась.");
      }
      setCampaign(body.campaign);
      setDeliveryPlans(body.deliveryPlans);
      if (body.deliveryJob) {
        setDeliveryJob(body.deliveryJob);
        setDispatchNotice(body.deliveryJob.statusMessage);
      }
      await loadCampaign();
    } catch (error) {
      setDispatchNotice(
        error instanceof Error ? error.message : "Отправка не началась.",
      );
      await loadCampaign();
    } finally {
      setDispatching(false);
    }
  }, [campaign, loadCampaign]);

  const deleteCampaign = React.useCallback(async () => {
    if (!campaign) return;
    if (!window.confirm(`Удалить кампанию «${campaign.name}» без возможности восстановления?`)) {
      return;
    }
    setDeleting(true);
    setDispatchNotice(null);
    try {
      const response = await fetch(`/api/campaigns?id=${encodeURIComponent(campaign.id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const body = await response.json() as { deletedId?: string } | ApiError;
      if (!response.ok || !("deletedId" in body)) {
        throw new Error("error" in body ? body.error : "Кампания не удалена.");
      }
      router.push("/campaigns");
      router.refresh();
    } catch (error) {
      setDispatchNotice(
        error instanceof Error ? error.message : "Кампания не удалена.",
      );
    } finally {
      setDeleting(false);
    }
  }, [campaign, router]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadCampaign());
    return () => window.cancelAnimationFrame(frame);
  }, [loadCampaign]);

  React.useEffect(() => {
    const providerCampaignId = deliveryJob?.providerExternalIds?.unisender?.campaignId;
    if (!campaign || !deliveryJob || !providerCampaignId || syncedJobsRef.current.has(deliveryJob.id)) return;
    syncedJobsRef.current.add(deliveryJob.id);
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ id: campaign.id, action: "sync_delivery" }),
          signal: controller.signal,
        });
        const body = await response.json() as CampaignMutationResponse | ApiError;
        if (!response.ok || !("campaign" in body)) return;
        setCampaign(body.campaign);
        setDeliveryPlans(body.deliveryPlans);
        if (body.deliveryJob) setDeliveryJob(body.deliveryJob);
        if (body.event) setEvents((current) => [body.event!, ...current.filter((event) => event.id !== body.event!.id)]);
        setDispatchNotice(body.deliveryJob?.statusMessage ?? body.campaign.statusReason);
        if (body.deliveryJob?.status === "processing") {
          window.setTimeout(() => {
            syncedJobsRef.current.delete(deliveryJob.id);
            void loadCampaign();
          }, 15_000);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          syncedJobsRef.current.delete(deliveryJob.id);
        }
      }
    })();
    return () => controller.abort();
  }, [campaign, deliveryJob, loadCampaign]);

  return (
    <CampaignDetailView
      campaignId={campaignId}
      campaign={campaign}
      deliveryPlans={deliveryPlans}
      events={events}
      deliveryJob={deliveryJob}
      apiMode={apiMode}
      onReload={() => void loadCampaign()}
      onDispatch={() => void dispatchCampaign()}
      dispatching={dispatching}
      deleting={deleting}
      dispatchNotice={dispatchNotice}
      timeZone={timeZone}
      onDelete={() => void deleteCampaign()}
    />
  );
}

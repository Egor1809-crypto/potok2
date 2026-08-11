"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { campaigns } from "@/data/mockCampaigns";
import type { Campaign, CampaignStatus } from "@/types";
import { CampaignDetailView } from "./CampaignDetailView";
import type { CampaignDeliveryPlan } from "./campaignChannels";

export function CampaignDetailRoute() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const campaignId = params?.id;
  const getStoredSnapshot = useCallback(
    () => campaignId ? window.localStorage.getItem(`mailflow:campaign:${campaignId}`) ?? "" : "",
    [campaignId],
  );
  const storedSnapshot = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    getStoredSnapshot,
    () => "",
  );
  const getDeliverySnapshot = useCallback(
    () => campaignId
      ? window.localStorage.getItem(`mailflow:campaign-delivery:${campaignId}`) ?? ""
      : "",
    [campaignId],
  );
  const deliverySnapshot = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    getDeliverySnapshot,
    () => "",
  );
  const storedCampaign = useMemo(() => {
    if (!storedSnapshot) return null;
    try {
      return JSON.parse(storedSnapshot) as Campaign;
    } catch {
      return null;
    }
  }, [storedSnapshot]);
  const deliveryPlan = useMemo(() => {
    if (!deliverySnapshot) return null;
    try {
      const value = JSON.parse(deliverySnapshot) as CampaignDeliveryPlan;
      return value?.demo === true && Array.isArray(value.channels)
        ? value
        : null;
    } catch {
      return null;
    }
  }, [deliverySnapshot]);

  const demoName = searchParams.get("demoName");
  const requestedStatus = searchParams.get("demoStatus");
  const demoStatus: CampaignStatus | undefined =
    requestedStatus === "scheduled" || requestedStatus === "sending"
      ? requestedStatus
      : undefined;
  const baseCampaign = campaigns.find((campaign) => campaign.id === campaignId);
  const queryCampaign = baseCampaign && demoName
    ? { ...baseCampaign, name: demoName, status: demoStatus ?? baseCampaign.status }
    : undefined;
  const campaign = storedCampaign ?? queryCampaign;

  return (
    <CampaignDetailView
      campaignId={campaignId}
      campaign={campaign}
      deliveryPlan={deliveryPlan}
    />
  );
}

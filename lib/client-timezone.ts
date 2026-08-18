"use client";

import * as React from "react";

export const DEFAULT_TIME_ZONE = "Europe/Moscow";

const subscribeToBrowserTimeZone = () => () => {};

export function detectBrowserTimeZone(fallback = DEFAULT_TIME_ZONE) {
  if (typeof window === "undefined") return fallback;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

export function useBrowserTimeZone(fallback = DEFAULT_TIME_ZONE) {
  return React.useSyncExternalStore(
    subscribeToBrowserTimeZone,
    () => detectBrowserTimeZone(fallback),
    () => fallback,
  );
}

export function describeTimeZone(timeZone: string) {
  try {
    const offset = new Intl.DateTimeFormat("ru-RU", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${timeZone} · ${offset}` : timeZone;
  } catch {
    return timeZone;
  }
}

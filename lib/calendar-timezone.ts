"use client";
import * as React from "react";
import { detectBrowserTimeZone, DEFAULT_TIME_ZONE } from "./client-timezone";
import { russianTimeZones } from "./russian-timezones";
const key = "potok.calendar.timezone";
const eventName = "potok-calendar-timezone";
function savedZone() {
  try { const value = localStorage.getItem(key); return russianTimeZones.some(zone => zone.value === value) ? value! : "auto"; } catch { return "auto"; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}
export function useCalendarTimeZone() {
  const preference = React.useSyncExternalStore(subscribe, savedZone, () => "auto");
  const browser = React.useSyncExternalStore(subscribe, () => detectBrowserTimeZone(), () => DEFAULT_TIME_ZONE);
  const [temporary, setTemporary] = React.useState<string | null>(null);
  const choice = temporary ?? preference;
  const setChoice = (value: string) => {
    if (value !== "auto" && !russianTimeZones.some(zone => zone.value === value)) return;
    try { localStorage.setItem(key, value); setTemporary(null); window.dispatchEvent(new Event(eventName)); }
    catch { setTemporary(value); }
  };
  return { timeZone: choice === "auto" ? browser : choice, choice, setChoice };
}

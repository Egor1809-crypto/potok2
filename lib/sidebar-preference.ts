"use client";

import { useSyncExternalStore } from "react";

const key = "potok:sidebar-collapsed";
const eventName = "potok:sidebar-preference";
let temporary: boolean | null = null;

function read() {
  if (temporary !== null) return temporary;
  try { return localStorage.getItem(key) === "true"; }
  catch { return false; }
}

function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useSidebarPreference() {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = () => {
    const next = !collapsed;
    try { localStorage.setItem(key, String(next)); temporary = null; }
    catch { temporary = next; }
    window.dispatchEvent(new Event(eventName));
  };
  return { collapsed, toggle };
}

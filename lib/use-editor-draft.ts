"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Draft<T> = { value: T; revision: string | null; at: number };
export function useEditorDraft<T>({ storageKey, value, dirty, revision, onRestore, onError }: {
  storageKey: string | null; value: T; dirty: boolean; revision: string | null;
  onRestore: (value: T, stale: boolean) => void; onError: (message: string) => void;
}) {
  const latest = useRef({ storageKey, value, dirty, revision, onRestore, onError });
  useLayoutEffect(() => { latest.current = { storageKey, value, dirty, revision, onRestore, onError }; });
  const [readyKey, setReadyKey] = useState<string | null>(null);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      const draft: Draft<T> | null = raw ? JSON.parse(raw) : null;
      if (draft && Date.now() - draft.at < 7 * 86400000) {
        latest.current.onRestore(draft.value, draft.revision !== latest.current.revision);
      }
    } catch { latest.current.onError("Не удалось прочитать черновик в браузере."); }
    // Start persistence only after the session snapshot has restored React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReadyKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || readyKey !== storageKey) return;
    const snapshot = latest.current;
    const save = () => {
      const current = latest.current.storageKey === storageKey ? latest.current : snapshot;
      try {
        if (!current.dirty) sessionStorage.removeItem(storageKey);
        else sessionStorage.setItem(storageKey, JSON.stringify({ value: current.value, revision: current.revision, at: Date.now() }));
      } catch { latest.current.onError("Браузеру не хватает места для черновика. Сохраните изменения кнопкой в редакторе."); }
    };
    const timer = window.setTimeout(save, 300);
    window.addEventListener("pagehide", save);
    const hidden = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", save); document.removeEventListener("visibilitychange", hidden); save(); };
  }, [storageKey, readyKey, value, dirty, revision]);
}

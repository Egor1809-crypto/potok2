"use client";
import { useEffect, useRef, useState } from "react";
import type { AiEmailStudioResponse } from "@/types/email-ai";

export function useEmailAiRequest() {
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [stage, setStage] = useState(0);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStage(value => Math.min(value + 1, 4)), 6500);
    return () => clearInterval(timer);
  }, [busy]);
  const run = async (action: string, payload: unknown): Promise<AiEmailStudioResponse | null> => {
    if (controller.current) return null;
    const active = new AbortController(); controller.current = active;
    setBusy(true); setError(""); setStage(0); setAction(action);
    try {
      const response = await fetch(`/api/email-ai/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: active.signal });
      const result = await response.json().catch(() => ({ error: "Сервер не ответил. Повторите попытку." })) as AiEmailStudioResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || (response.status === 401 ? "Войдите в аккаунт и повторите попытку." : "Не удалось подготовить письмо."));
      return active.signal.aborted ? null : result;
    } catch (caught) {
      if (!active.signal.aborted) setError(caught instanceof Error ? caught.message : "Проверьте подключение и повторите попытку.");
      return null;
    } finally {
      if (controller.current === active) { controller.current = null; setBusy(false); }
    }
  };
  return { run, busy, error, setError, cancel: () => controller.current?.abort(), stage, stageLabel: action === "review" ? "Проверяем текст и замечания ИИ-редактора…" : action === "subject-variants" ? "Подбираем темы по текущему письму…" : ["Изучаем задачу…", "Продумываем структуру…", "Пишем содержание…", "Подбираем дизайн…", "Проверяем письмо…"][stage] };
}

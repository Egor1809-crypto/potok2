"use client";
import * as React from "react";
import Link from "next/link";
import { Alert, Badge, Button } from "@/components/ui";
import type { CommunicationCheck } from "@/lib/communications/types";
import { communicationApi } from "./api";
export function CampaignCommunicationCheck({ audienceType, contactIds, segmentId, channels, purpose, scheduledAt, onUseContacts }: {
    audienceType: string;
    contactIds: string[];
    segmentId: string;
    channels: string[];
    purpose: string;
    scheduledAt: string | null;
    onUseContacts: (ids: string[]) => void;
}) {
    const [chosen, setChosen] = React.useState<string[]>([]);
    const [result, setResult] = React.useState<{
        signature: string;
        data: CommunicationCheck;
    } | null>(null);
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const signature = JSON.stringify({ audienceType, contactIds, segmentId, channels, purpose, scheduledAt });
    const check = result?.signature === signature ? result.data : null;
    async function load() { setBusy(true); setError(""); try {
        const data = await communicationApi<CommunicationCheck>({ action: "check", ...JSON.parse(signature) });
        setResult({ signature, data });
        setChosen(data.allowedIds);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Проверка недоступна.");
    }
    finally {
        setBusy(false);
    } }
    return <section className="mt-6 rounded-xl border border-border p-4" aria-label="Проверка аудитории">
    <h2 className="text-base font-semibold">Проверка аудитории</h2><p className="mt-2 text-sm text-text-muted">Основания, ответы и нагрузка проверяются сейчас и повторно перед отправкой по расписанию.</p>
    <Button className="mt-3" variant="secondary" loading={busy} onClick={() => void load()}>Проверить контакты</Button>
    {error ? <Alert className="mt-3" tone="danger" title="Проверка недоступна">{error}</Alert> : null}
    {check ? <><div className="mt-4 flex flex-wrap gap-2"><Badge variant="success">Допущено: {check.allowedIds.length}</Badge><Badge variant="danger">Исключить или проверить: {check.blockedIds.length}</Badge><Badge variant="warning">Нагрузка: {check.warningIds.length}</Badge></div>
      <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={!check.blockedIds.length} onClick={() => onUseContacts(check.allowedIds)}>Исключить рискованные контакты</Button><Button size="sm" variant="outline" disabled={!check.warningIds.length} onClick={() => onUseContacts(check.allowedIds.filter(id => !check.warningIds.includes(id)))}>Исключить перегруженных</Button></div>
      <p className="mt-2 text-xs text-text-muted">При исключении сегмент превращается в точный список получателей.</p>
      <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Причины по контактам ({check.rows.length})</summary><div className="mt-3 max-h-96 space-y-3 overflow-y-auto">{check.rows.map(row => <div key={`${row.id}:${row.channel}`} className="rounded-lg bg-surface-subtle p-3 text-sm"><label className="mb-2 flex items-center gap-2"><input type="checkbox" disabled={row.blocked} checked={chosen.includes(row.id)} onChange={e => setChosen(ids => e.target.checked ? [...new Set([...ids, row.id])] : ids.filter(id => id !== row.id))}/>Включить контакт</label><Link className="font-semibold text-primary" href={`/communications?contact=${row.id}`}>{row.name}</Link> · {row.channel}<p>{row.sent} сообщений · {row.percentage}% лимита</p>{[...row.reasons, ...row.warnings].map(reason => <p key={reason} className="mt-1">{reason}</p>)}{!row.reasons.length && !row.warnings.length ? <p>Проверка пройдена</p> : null}</div>)}</div></details><Button className="mt-3" size="sm" variant="outline" onClick={() => onUseContacts(chosen)}>Применить выбранных: {chosen.length}</Button>
    </> : null}
  </section>;
}

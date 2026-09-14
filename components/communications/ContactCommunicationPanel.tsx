"use client";
/* eslint jsx-a11y/label-has-associated-control: ["error", {"controlComponents": ["Input", "Select", "Textarea"], "depth": 3}] */
import * as React from "react";
import { Alert, Badge, Button, Input, Select, Textarea } from "@/components/ui";
import type { ContactCommunicationData } from "@/lib/communications/types";
import { communicationApi } from "./api";
import { Avatar } from "@/components/ui/avatar";
import { Gauge, ShieldCheck } from "@/components/ui/icons";
import styles from "./communications.module.css";
const date = (value: string) => new Date(value).toLocaleString("ru-RU");
const states: Record<string, string> = { confirmed: "Подтверждено", missing: "Нет основания", review: "Требует проверки", revoked: "Отозвано", expired: "Срок истёк" };
export function ContactCommunicationPanel({ contactId, variant = "default" }: {
    contactId: string;
    variant?: "default" | "workspace";
}) {
    const [data, setData] = React.useState<ContactCommunicationData | null>(null);
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState("");
    const load = React.useCallback(async (signal?: AbortSignal) => { try {
        setData(await communicationApi<ContactCommunicationData>(undefined, `?contact=${encodeURIComponent(contactId)}`, signal));
        setError("");
    }
    catch (e) {
        if (!signal?.aborted)
            setError(e instanceof Error ? e.message : "Не удалось загрузить паспорт.");
    } }, [contactId]);
    React.useEffect(() => { const controller = new AbortController(); const frame = requestAnimationFrame(() => void load(controller.signal)); return () => { cancelAnimationFrame(frame); controller.abort(); }; }, [load]);
    async function mutate(body: Record<string, unknown>) { setBusy(true); setError(""); try {
        await communicationApi({ ...body, contactId });
        setNotice("Изменения сохранены.");
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось сохранить.");
    }
    finally {
        setBusy(false);
    } }
    async function grant(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const f = new FormData(form); await mutate({ action: "grant", channel: f.get("channel"), purpose: f.get("purpose"), operator: f.get("operator"), source: f.get("source"), version: f.get("version"), statement: f.get("statement"), obtainedAt: new Date(String(f.get("obtainedAt"))).toISOString(), expiresAt: f.get("expiresAt") ? new Date(String(f.get("expiresAt"))).toISOString() : null }); }
    const row = data?.check.rows[0];
    const pressureTone = (row?.percentage ?? 0) >= 100 ? "danger" : (row?.percentage ?? 0) >= 75 ? "warning" : "success";
    return <section className={variant === "workspace" ? styles.contactWorkspace : `mt-6 ${styles.contactEmbedded}`} aria-label="Нагрузка и паспорт данных">
    {variant === "workspace" && data ? <header className={styles.identityHeader}>
      <Avatar name={data.contact.fullName} size="lg" aria-hidden="true"/>
      <div><h2>{data.contact.fullName}</h2><p>{[data.contact.email || data.contact.phone, data.contact.companyName && data.contact.companyName !== data.contact.fullName ? data.contact.companyName : ""].filter(Boolean).join(" · ")}</p></div>
    </header> : null}
    <div className={variant === "workspace" ? styles.detailScroll : styles.contactContent} role={variant === "workspace" ? "region" : undefined} aria-label={variant === "workspace" ? "Данные выбранного контакта" : undefined} tabIndex={variant === "workspace" ? 0 : undefined}>
    {error ? <Alert tone="danger" title="Не удалось выполнить действие">{error}<Button variant="ghost" onClick={() => void load()}>Повторить</Button></Alert> : null}
    <p role="status" className={styles.notice}>{notice}</p>
    {!data ? <p className="text-sm text-text-muted">Загружаем историю и основания…</p> : <>
      <section className={styles.insightCard} data-tone={pressureTone}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={styles.sectionTitle}><span className={styles.sectionIcon}><Gauge size={22} aria-hidden="true"/></span>Нагрузка контакта</h3><Badge variant={pressureTone} dot>{row?.percentage ?? 0}% лимита</Badge></div>
        <progress className={styles.pressureBar} data-tone={pressureTone} value={Math.min(100, row?.percentage ?? 0)} max={100} aria-label="Использование лимита сообщений"/>
        <p className="mt-2 text-sm">{row?.sent ?? 0} из {data.policy.contact_limit} сообщений за {data.policy.window_days} дней</p>
        <p className="mt-2 text-xs leading-5 text-text-muted">Учтены отправки через Поток. Личные письма из неподключённых ящиков не учитываются. Процент показывает использование установленного лимита.</p>
        {data.contact.companyName ? <p className="mt-3 text-sm">{data.contact.companyName}: {data.companyHistory.total} сообщений, {data.companyHistory.recipients} адресатов за этот период.</p> : null}
        <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">История касаний ({data.history.length})</summary><ul className="mt-3 space-y-3">{data.history.map(h => <li key={h.id} className="text-sm"><span className="font-medium">{h.author || "Команда"}</span> · {h.channel}<br />{h.campaign_name}<br /><span className="text-xs text-text-muted">{date(h.occurred_at)}</span></li>)}</ul>{!data.history.length ? <p className="mt-2 text-sm text-text-muted">Отправок пока нет.</p> : null}</details>
      </section>
      {data.holds.length ? <Alert tone="warning" title="Автоматические письма приостановлены">{data.holds.map(h => <p key={h.id}>{h.reason}</p>)}<Button className="mt-3" variant="outline" disabled={busy} onClick={() => void mutate({ action: "resume" })}>Возобновить после проверки ответа</Button><p className="mt-2 text-xs">Возобновление не отменяет отписку.</p></Alert> : null}
      <section className={styles.insightCard} data-tone={row && !row.blocked ? "success" : "warning"}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={styles.sectionTitle}><span className={styles.sectionIcon}><ShieldCheck size={22} aria-hidden="true"/></span>Паспорт данных</h3><Badge variant={row && !row.blocked ? "success" : "warning"}>{row?.consent === "confirmed" && row.blocked ? "Требует проверки" : states[row?.consent ?? "missing"]}</Badge></div>
        <p className="mt-2 text-xs leading-5 text-text-muted">Статус рекламного Email. Отдельно фиксируются основание обработки данных и основание рекламного обращения. Старые отметки согласия требуют проверки подтверждений. IP при ручном внесении не считается IP получателя.</p>
        {row?.reasons.length ? <ul className="mt-3 space-y-1 text-sm">{row.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
        <a className="btn btn-secondary mt-4" href={`/api/communications?contact=${encodeURIComponent(contactId)}&export=1`}>Скачать подтверждения согласия</a>
        <div className="mt-4 space-y-3">{data.evidence.map(e => <details key={e.id} className="rounded-lg bg-surface-subtle p-3"><summary className="cursor-pointer text-sm font-medium">{e.kind === "revoke" ? "Отзыв" : "Основание"} · {e.channel} · {e.purpose === "marketing" ? "Рекламные сообщения" : e.purpose === "data_processing" ? "Обработка данных" : "Сервисные сообщения"} · {e.version || "Без версии"}</summary><dl className="mt-3 space-y-2 break-words text-sm"><div><dt className="text-text-muted">Оператор</dt><dd>{e.operator || "Не указан"}</dd></div><div><dt className="text-text-muted">Источник</dt><dd>{e.source}</dd></div><div><dt className="text-text-muted">Получено</dt><dd>{date(e.obtained_at)}</dd></div><div><dt className="text-text-muted">Срок</dt><dd>{e.expires_at ? date(e.expires_at) : "Не указан в записи"}</dd></div><div><dt className="text-text-muted">Адрес</dt><dd>{e.endpoint}</dd></div><div><dt className="text-text-muted">Текст</dt><dd className="whitespace-pre-wrap">{e.statement}</dd></div><div><dt className="text-text-muted">SHA-256</dt><dd className="text-xs">{e.digest}</dd></div></dl><Button className="mt-3" size="sm" variant="outline" disabled={busy} onClick={() => void mutate({ action: "revoke", channel: e.channel, purpose: e.purpose, source: "Отзыв зафиксирован ответственным" })}>Зафиксировать отзыв</Button></details>)}</div>
        <details className="mt-5"><summary className="cursor-pointer text-sm font-semibold text-primary">Добавить подтверждённое основание</summary>
          <form onSubmit={grant} className="mt-4 grid gap-3">
            <label className="text-sm">Канал<Select name="channel" options={[{ value: "email", label: "Email" }, { value: "telegram", label: "Telegram" }, { value: "vk", label: "ВКонтакте" }]}/></label>
            <label className="text-sm">Цель<Select name="purpose" options={[{ value: "marketing", label: "Рекламные сообщения" }, { value: "transactional", label: "Сервисные сообщения" }, { value: "data_processing", label: "Обработка персональных данных" }]}/></label>
            <label className="text-sm">Оператор данных<Input name="operator" required maxLength={300} defaultValue={data.check.operatorName}/></label>
            <label className="text-sm">Источник и ссылка на первичное подтверждение<Input name="source" required maxLength={500}/></label>
            <label className="text-sm">Дата получения<Input name="obtainedAt" type="datetime-local" required/></label>
            <label className="text-sm">Действует до, если указано<Input name="expiresAt" type="datetime-local"/></label>
            <label className="text-sm">Версия согласия или документа<Input name="version" required maxLength={100}/></label>
            <label className="text-sm">Точный текст основания<Textarea name="statement" required maxLength={12000} rows={5}/></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1"/>Подтверждаю, что сверил сведения с первичным документом.</label>
            <Button type="submit" loading={busy}>Сохранить основание</Button>
          </form>
        </details>
      </section>
    </>}
    </div>
  </section>;
}

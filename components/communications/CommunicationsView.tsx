"use client";
/* eslint jsx-a11y/label-has-associated-control: ["error", {"controlComponents": ["Input", "Select", "Textarea"], "depth": 3}] */
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Input, Select, Textarea } from "@/components/ui";
import { PageHeader } from "@/components/shared/PageHeader";
import { replyCategories } from "@/lib/communications/rules";
import type { CommunicationOverview, TaskRecord } from "@/lib/communications/types";
import { communicationApi } from "./api";
import { ContactCommunicationPanel } from "./ContactCommunicationPanel";
export function CommunicationsView() {
    const params = useSearchParams();
    const [contactId, setContactId] = React.useState(params.get("contact") ?? "");
    const [tab, setTab] = React.useState("contacts");
    const [query, setQuery] = React.useState("");
    const [category, setCategory] = React.useState("");
    const [data, setData] = React.useState<CommunicationOverview | null>(null);
    const [error, setError] = React.useState("");
    const [notice, setNotice] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const requestedContact = params.get("contact");
    React.useEffect(() => {
        if (!requestedContact) return;
        const frame = requestAnimationFrame(() => { setContactId(requestedContact); setTab("contacts"); });
        return () => cancelAnimationFrame(frame);
    }, [requestedContact]);
    const load = React.useCallback(async (signal?: AbortSignal) => { try {
        setData(await communicationApi<CommunicationOverview>(undefined, `?q=${encodeURIComponent(query)}`, signal));
        setError("");
    }
    catch (e) {
        if (!signal?.aborted)
            setError(e instanceof Error ? e.message : "Не удалось загрузить данные.");
    } }, [query]);
    React.useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 250); return () => { clearTimeout(timer); controller.abort(); }; }, [load]);
    async function mutate(body: unknown) { setBusy(true); setError(""); try {
        await communicationApi(body);
        setNotice("Сохранено.");
        await load();
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось сохранить.");
        return false;
    }
    finally {
        setBusy(false);
    } }
    async function addReply(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const f = new FormData(form); const ok = await mutate({ action: "reply", contactId: f.get("contactId"), externalId: f.get("externalId"), subject: f.get("subject"), body: f.get("body") }); if (ok)
        form.reset(); }
    return <div className="space-y-5"><PageHeader title="Коммуникации"/>
    <div className="flex flex-wrap gap-2" aria-label="Разделы коммуникаций">{[["contacts", "Нагрузка и паспорта"], ["replies", "Ответы"], ["tasks", "Задачи"], ["settings", "Правила и подключение"]].map(([id, label]) => <Button key={id} variant={tab === id ? "primary" : "secondary"} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</Button>)}</div>
    {error ? <Alert tone="danger" title="Не удалось выполнить действие">{error}<Button onClick={() => void load()} variant="ghost">Повторить</Button></Alert> : null}<p role="status" className="text-sm text-text-muted">{notice}</p>
    {!data ? <p>Загружаем коммуникации…</p> : <>
      {tab === "contacts" ? <div className="grid min-w-0 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]"><section className="card min-w-0 p-4"><label className="text-sm font-medium">Найти контакт<Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Имя, email или компания"/></label><p className="mt-2 text-xs text-text-muted">Показано до 50 контактов. Уточните поиск.</p><div className="mt-4 space-y-2">{data.people.map(p => <button key={p.id} type="button" onClick={() => setContactId(p.id)} aria-pressed={contactId === p.id} className={`w-full rounded-lg border p-3 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${contactId === p.id ? "border-primary bg-primary-subtle" : "border-border"}`}><span className="block text-sm font-semibold">{p.full_name}</span><span className="block break-words text-xs text-text-muted">{p.email}<br />{p.company_name}</span></button>)}</div></section><section className="card min-w-0 p-4 sm:p-6">{contactId ? <ContactCommunicationPanel key={contactId} contactId={contactId}/> : <p className="text-sm text-text-muted">Выберите контакт, чтобы посмотреть нагрузку и паспорт данных.</p>}</section></div> : null}
      {tab === "replies" ? <section className="card space-y-5 p-4 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Ответы на кампании</h2><Button variant="outline" onClick={() => void load()}>Обновить</Button></div><p className="text-sm text-text-muted">Последние 100 входящих сообщений. Автоматическая цепочка приостанавливается после человеческого ответа.</p>
        {!data.webhookConfigured ? <Alert tone="info" title="Входящая почта ещё не подключена">Пока можно добавить полученный ответ вручную. Автоматическое получение станет доступно после подключения почтового сервиса.</Alert> : null}
        <div className="flex flex-wrap gap-2">{Object.entries(replyCategories).map(([id, label]) => <Badge key={id}>{label}: {data.replies.filter(r => r.category === id).length}</Badge>)}</div>
        <label className="block max-w-sm text-sm">Категория<Select value={category} onChange={e => setCategory(e.target.value)} options={[{ value: "", label: "Все ответы" }, ...Object.entries(replyCategories).map(([value, label]) => ({ value, label }))]}/></label>
        <details><summary className="cursor-pointer font-medium text-primary">Добавить ответ из почты</summary><form className="mt-4 grid max-w-2xl gap-3" onSubmit={addReply}><label className="text-sm">Контакт<Select name="contactId" required options={[{ value: "", label: "Выберите контакт" }, ...data.people.map(p => ({ value: p.id, label: `${p.full_name} · ${p.email}` }))]}/></label><p className="text-xs text-text-muted">Если контакта нет в списке, найдите его во вкладке «Нагрузка и паспорта».</p><label className="text-sm">Message-ID письма или уникальный номер записи<Input name="externalId" required maxLength={300}/></label><label className="text-sm">Тема<Input name="subject" maxLength={500}/></label><label className="text-sm">Ответ получателя<Textarea name="body" required maxLength={12000} rows={6}/></label><Button type="submit" loading={busy}>Сохранить и разобрать ответ</Button></form></details>
        <div className="space-y-4">{data.replies.filter(r => !category || r.category === category).map(r => <article key={r.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><Link className="font-semibold text-primary" href={`/communications?contact=${r.contact_id}`}>{r.contact_name}</Link><span className="text-xs text-text-muted">{new Date(r.received_at).toLocaleString("ru-RU")}</span></div><h3 className="mt-2 text-sm font-semibold">{r.subject || "Без темы"}</h3>{r.campaign_name ? <p className="text-xs">Кампания: {r.campaign_name}</p> : null}<p className="mt-3 whitespace-pre-wrap text-sm leading-6">{r.body}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Категория<Select value={r.category} disabled={busy} onChange={e => void mutate({ action: "classify", id: r.id, category: e.target.value })} options={Object.entries(replyCategories).map(([value, label]) => ({ value, label }))}/></label><div className="text-xs text-text-muted">{r.reviewed ? "Проверено участником" : `${r.classifier} · уверенность ${r.confidence}%`}{r.suggested_date ? <p className="mt-2">Предложенная дата: {r.suggested_date}</p> : null}</div></div></article>)}</div>{!data.replies.length ? <p className="text-sm text-text-muted">Ответов пока нет.</p> : null}
      </section> : null}
      {tab === "tasks" ? <section className="card space-y-4 p-4 sm:p-6"><h2 className="text-lg font-semibold">Следующие действия</h2><p className="text-sm text-text-muted">Проверьте предложенные дату и способ связи. Выполнение задачи само по себе не возобновляет рассылки.</p>{data.tasks.map(task => <TaskCard key={`${task.id}:${task.status}:${task.due_date}`} task={task} members={data.members} busy={busy} save={mutate}/>)}{!data.tasks.length ? <p className="text-sm text-text-muted">Задачи появятся после разбора ответов.</p> : null}</section> : null}
      {tab === "settings" ? <section className="card grid gap-6 p-4 sm:p-6 lg:grid-cols-2"><form className="grid content-start gap-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void mutate({ action: "policy", windowDays: Number(f.get("windowDays")), contactLimit: Number(f.get("contactLimit")), companyLimit: Number(f.get("companyLimit")), autoTasks: f.has("autoTasks") }); }}><h2 className="text-lg font-semibold">Правила команды</h2><label className="text-sm">Период нагрузки, дней<Input name="windowDays" type="number" min={1} max={90} required defaultValue={data.policy.window_days}/></label><label className="text-sm">Рекомендуемый лимит сообщений контакту<Input name="contactLimit" type="number" min={1} max={100} required defaultValue={data.policy.contact_limit}/></label><label className="text-sm">Рекомендуемое число адресатов одной компании<Input name="companyLimit" type="number" min={1} max={100} required defaultValue={data.policy.company_limit}/></label><p className="text-xs leading-5 text-text-muted">Превышение нагрузки — предупреждение. Отсутствие основания, отзыв и пауза после ответа блокируют автоматическую отправку.</p><label className="flex gap-2 text-sm"><input name="autoTasks" type="checkbox" defaultChecked={Boolean(data.policy.auto_tasks)}/>Создавать задачи автоматически при высокой уверенности и определённой дате</label><Button type="submit" loading={busy}>Сохранить правила</Button></form><div><h2 className="text-lg font-semibold">Подключение входящих</h2><p className="mt-3 text-sm">Приём почты: {data.webhookConfigured ? "секрет настроен; проверьте передачу писем" : "не подключён"}</p><p className="mt-2 text-sm">AI-разбор: {data.aiConfigured ? "доступен" : "используются правила, результаты требуют проверки"}</p><p className="mt-4 text-sm leading-6 text-text-muted">Подключите почтовый сервис, который передаёт ответы в Поток. Для интегратора подготовлен HTTP-приёмник с проверкой подписи. SMTP-подключение для отправки не читает входящую почту.</p><details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Данные для интегратора</summary><p className="mt-3 break-all text-sm">POST {data.webhookPath}</p><p className="mt-2 text-xs leading-5">Заголовки X-Potok-Timestamp (Unix, секунды), X-Potok-Signature (sha256=HMAC-SHA256 от timestamp.body). Общий секрет: COMMUNICATION_WEBHOOK_SECRET. JSON: externalId, contactId, sender, subject, body, receivedAt, необязательный campaignId. Секрет задаётся администратором на сервере.</p></details></div></section> : null}
    </>}
  </div>;
}
function TaskCard({ task, members, busy, save }: {
    task: TaskRecord;
    members: CommunicationOverview["members"];
    busy: boolean;
    save: (body: unknown) => Promise<boolean>;
}) {
    const [date, setDate] = React.useState(task.due_date ?? "");
    const [assigned, setAssigned] = React.useState(task.assigned_to);
    const statuses: Record<string, string> = { proposed: "На проверке", open: "Запланировано", done: "Выполнено", dismissed: "Отклонено" };
    return <article className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{task.title}</h3><Badge>{statuses[task.status]}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Дата<Input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label className="text-sm">Ответственный<Select value={assigned} onChange={e => setAssigned(e.target.value)} options={members.map(m => ({ value: m.id, label: m.display_name }))}/></label></div><div className="mt-3 flex flex-wrap gap-2">{[["open", "Сохранить задачу"], ["done", "Выполнено"], ["dismissed", "Отклонить"]].map(([status, label]) => <Button key={status} size="sm" variant={status === "open" ? "primary" : "outline"} disabled={busy} onClick={() => void save({ action: "task", id: task.id, status, assignedTo: assigned, dueDate: date || null })}>{label}</Button>)}</div></article>;
}

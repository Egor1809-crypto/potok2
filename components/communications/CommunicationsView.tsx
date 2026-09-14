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
import { Avatar } from "@/components/ui/avatar";
import { ArrowLeft, Check, Clock3, Gauge, Inbox, Search, SlidersHorizontal, UsersRound } from "@/components/ui/icons";
import styles from "./communications.module.css";

const sections = [
    { id: "contacts", label: "Нагрузка и паспорта", icon: Gauge },
    { id: "replies", label: "Ответы", icon: Inbox },
    { id: "tasks", label: "Задачи", icon: Clock3 },
    { id: "settings", label: "Правила и подключение", icon: SlidersHorizontal },
];
export function CommunicationsView() {
    const params = useSearchParams();
    const [contactId, setContactId] = React.useState(params.get("contact") ?? "");
    const [showContact, setShowContact] = React.useState(Boolean(params.get("contact")));
    const contactListRef = React.useRef<HTMLDivElement>(null);
    const backButtonRef = React.useRef<HTMLButtonElement>(null);
    function openContact(id: string) {
        setContactId(id);
        setShowContact(true);
        requestAnimationFrame(() => {
            if (backButtonRef.current?.getClientRects().length) backButtonRef.current.focus({ preventScroll: true });
        });
    }
    function returnToContacts() {
        setShowContact(false);
        requestAnimationFrame(() => {
            const selected = contactListRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
            (selected ?? contactListRef.current)?.focus({ preventScroll: true });
        });
    }
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
        const frame = requestAnimationFrame(() => { setContactId(requestedContact); setShowContact(true); setTab("contacts"); });
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
    return <div className={styles.workspace}>
    <header className={styles.header}>
      <PageHeader title="Коммуникации"/>
      <div className={styles.tabs} role="group" aria-label="Разделы коммуникаций">
        {sections.map(({id, label, icon: Icon}) => <button key={id} type="button" className={styles.tab} aria-pressed={tab === id} onClick={() => setTab(id)}>
          <Icon size={22} aria-hidden="true"/><span>{label}</span>
          {id === "replies" && data?.replies.length ? <span className={styles.tabCount}>{data.replies.length}</span> : null}
          {id === "tasks" && data?.tasks.some(task => ["open", "proposed"].includes(task.status)) ? <span className={styles.tabCount}>{data.tasks.filter(task => ["open", "proposed"].includes(task.status)).length}</span> : null}
        </button>)}
      </div>
    </header>
    <div className={styles.feedback}>
      {error ? <Alert tone="danger" title="Не удалось выполнить действие">{error}<Button onClick={() => void load()} variant="ghost">Повторить</Button></Alert> : null}
      <p role="status" className={styles.notice}>{notice}</p>
    </div>
    {!data ? <div className={styles.emptyState} role="status"><span className={styles.emptyIcon}><UsersRound size={32} aria-hidden="true"/></span><p>Загружаем коммуникации…</p></div> : <>
      {tab === "contacts" ? <div className={styles.contactLayout} data-contact-open={showContact}>
        <section className={styles.contactsPane} aria-label="Выбор контакта">
          <div className={styles.searchHeader}>
            <label htmlFor="communication-search" className={styles.searchLabel}>Найти контакт</label>
            <div className={styles.searchInput}><Search size={20} aria-hidden="true"/><Input id="communication-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Имя, email или компания"/></div>
            <p className={styles.resultCount} aria-live="polite">{data.people.length >= 50 ? "Показаны первые 50 · уточните поиск" : `Найдено контактов: ${data.people.length}`}</p>
          </div>
          <div ref={contactListRef} className={styles.contactScroll} role="region" aria-label="Список контактов" tabIndex={0}>
            <ul className={styles.contactList}>{data.people.map(p => <li key={p.id}>
              <button type="button" onClick={() => openContact(p.id)} aria-pressed={contactId === p.id} className={styles.contactButton}>
                <Avatar name={p.full_name} size="md" className={styles.contactAvatar} aria-hidden="true"/>
                <span className={styles.contactText}><span className={styles.contactName}>{p.full_name}</span>{p.email ? <span className={styles.contactMeta}>{p.email}</span> : null}{p.company_name && p.company_name !== p.full_name && p.company_name !== "—" ? <span className={styles.contactCompany}>{p.company_name}</span> : null}</span>
                <Check size={18} aria-hidden="true" className={styles.selectedMark}/>
              </button>
            </li>)}</ul>
            {!data.people.length ? <div className={styles.listEmpty}><Search size={28} aria-hidden="true"/><p>Контакты не найдены</p><span>Измените запрос.</span></div> : null}
          </div>
        </section>
        <section className={styles.detailPane} aria-label="Карточка контакта">
          <button ref={backButtonRef} type="button" className={styles.backButton} onClick={returnToContacts}><ArrowLeft size={20} aria-hidden="true"/>К списку контактов</button>
          {contactId ? <ContactCommunicationPanel key={contactId} contactId={contactId} variant="workspace"/> : <div className={styles.emptyState}><span className={styles.emptyIcon}><UsersRound size={36} aria-hidden="true"/></span><h2>Выберите контакт</h2><p>Откроются нагрузка, история сообщений и паспорт данных.</p></div>}
        </section>
      </div> : null}
      {tab !== "contacts" ? <div className={styles.tabBody} role="region" aria-label={sections.find(section => section.id === tab)?.label} tabIndex={0}>
      {tab === "replies" ? <section className={`card space-y-5 p-4 sm:p-6 ${styles.contentCard}`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Ответы на кампании</h2><Button variant="outline" onClick={() => void load()}>Обновить</Button></div><p className="text-sm text-text-muted">Последние 100 входящих сообщений. Автоматическая цепочка приостанавливается после человеческого ответа.</p>
        {!data.webhookConfigured ? <Alert tone="info" title="Входящая почта ещё не подключена">Пока можно добавить полученный ответ вручную. Автоматическое получение станет доступно после подключения почтового сервиса.</Alert> : null}
        <div className="flex flex-wrap gap-2">{Object.entries(replyCategories).map(([id, label]) => <Badge key={id}>{label}: {data.replies.filter(r => r.category === id).length}</Badge>)}</div>
        <label className="block max-w-sm text-sm">Категория<Select value={category} onChange={e => setCategory(e.target.value)} options={[{ value: "", label: "Все ответы" }, ...Object.entries(replyCategories).map(([value, label]) => ({ value, label }))]}/></label>
        <details><summary className="cursor-pointer font-medium text-primary">Добавить ответ из почты</summary><form className="mt-4 grid max-w-2xl gap-3" onSubmit={addReply}><label className="text-sm">Контакт<Select name="contactId" required options={[{ value: "", label: "Выберите контакт" }, ...data.people.map(p => ({ value: p.id, label: `${p.full_name} · ${p.email}` }))]}/></label><p className="text-xs text-text-muted">Если контакта нет в списке, найдите его во вкладке «Нагрузка и паспорта».</p><label className="text-sm">Message-ID письма или уникальный номер записи<Input name="externalId" required maxLength={300}/></label><label className="text-sm">Тема<Input name="subject" maxLength={500}/></label><label className="text-sm">Ответ получателя<Textarea name="body" required maxLength={12000} rows={6}/></label><Button type="submit" loading={busy}>Сохранить и разобрать ответ</Button></form></details>
        <div className="space-y-4">{data.replies.filter(r => !category || r.category === category).map(r => <article key={r.id} className={styles.recordCard}><div className="flex flex-wrap justify-between gap-2"><Link className="font-semibold text-primary" href={`/communications?contact=${r.contact_id}`}>{r.contact_name}</Link><span className="text-xs text-text-muted">{new Date(r.received_at).toLocaleString("ru-RU")}</span></div><h3 className="mt-2 text-sm font-semibold">{r.subject || "Без темы"}</h3>{r.campaign_name ? <p className="text-xs">Кампания: {r.campaign_name}</p> : null}<p className="mt-3 whitespace-pre-wrap text-sm leading-6">{r.body}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Категория<Select value={r.category} disabled={busy} onChange={e => void mutate({ action: "classify", id: r.id, category: e.target.value })} options={Object.entries(replyCategories).map(([value, label]) => ({ value, label }))}/></label><div className="text-xs text-text-muted">{r.reviewed ? "Проверено участником" : `${r.classifier} · уверенность ${r.confidence}%`}{r.suggested_date ? <p className="mt-2">Предложенная дата: {r.suggested_date}</p> : null}</div></div></article>)}</div>{!data.replies.length ? <p className="text-sm text-text-muted">Ответов пока нет.</p> : null}
      </section> : null}
      {tab === "tasks" ? <section className={`card space-y-4 p-4 sm:p-6 ${styles.contentCard}`}><h2 className="text-lg font-semibold">Следующие действия</h2><p className="text-sm text-text-muted">Проверьте предложенные дату и способ связи. Выполнение задачи само по себе не возобновляет рассылки.</p>{data.tasks.map(task => <TaskCard key={`${task.id}:${task.status}:${task.due_date}`} task={task} members={data.members} busy={busy} save={mutate}/>)}{!data.tasks.length ? <p className="text-sm text-text-muted">Задачи появятся после разбора ответов.</p> : null}</section> : null}
      {tab === "settings" ? <section className={`card grid gap-6 p-4 sm:p-6 lg:grid-cols-2 ${styles.contentCard}`}><form className="grid content-start gap-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void mutate({ action: "policy", windowDays: Number(f.get("windowDays")), contactLimit: Number(f.get("contactLimit")), companyLimit: Number(f.get("companyLimit")), autoTasks: f.has("autoTasks") }); }}><h2 className="text-lg font-semibold">Правила команды</h2><label className="text-sm">Период нагрузки, дней<Input name="windowDays" type="number" min={1} max={90} required defaultValue={data.policy.window_days}/></label><label className="text-sm">Рекомендуемый лимит сообщений контакту<Input name="contactLimit" type="number" min={1} max={100} required defaultValue={data.policy.contact_limit}/></label><label className="text-sm">Рекомендуемое число адресатов одной компании<Input name="companyLimit" type="number" min={1} max={100} required defaultValue={data.policy.company_limit}/></label><p className="text-xs leading-5 text-text-muted">Превышение нагрузки — предупреждение. Отсутствие основания, отзыв и пауза после ответа блокируют автоматическую отправку.</p><label className="flex gap-2 text-sm"><input name="autoTasks" type="checkbox" defaultChecked={Boolean(data.policy.auto_tasks)}/>Создавать задачи автоматически при высокой уверенности и определённой дате</label><Button type="submit" loading={busy}>Сохранить правила</Button></form><div><h2 className="text-lg font-semibold">Подключение входящих</h2><p className="mt-3 text-sm">Приём почты: {data.webhookConfigured ? "секрет настроен; проверьте передачу писем" : "не подключён"}</p><p className="mt-2 text-sm">AI-разбор: {data.aiConfigured ? "доступен" : "используются правила, результаты требуют проверки"}</p><p className="mt-4 text-sm leading-6 text-text-muted">Подключите почтовый сервис, который передаёт ответы в Поток. Для интегратора подготовлен HTTP-приёмник с проверкой подписи. SMTP-подключение для отправки не читает входящую почту.</p><details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Данные для интегратора</summary><p className="mt-3 break-all text-sm">POST {data.webhookPath}</p><p className="mt-2 text-xs leading-5">Заголовки X-Potok-Timestamp (Unix, секунды), X-Potok-Signature (sha256=HMAC-SHA256 от timestamp.body). Общий секрет: COMMUNICATION_WEBHOOK_SECRET. JSON: externalId, contactId, sender, subject, body, receivedAt, необязательный campaignId. Секрет задаётся администратором на сервере.</p></details></div></section> : null}
      </div> : null}
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
    return <article className={styles.recordCard}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{task.title}</h3><Badge variant={task.status === "done" ? "success" : task.status === "proposed" ? "warning" : task.status === "open" ? "accent" : "neutral"} dot>{statuses[task.status]}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Дата<Input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><label className="text-sm">Ответственный<Select value={assigned} onChange={e => setAssigned(e.target.value)} options={members.map(m => ({ value: m.id, label: m.display_name }))}/></label></div><div className="mt-3 flex flex-wrap gap-2">{[["open", "Сохранить задачу"], ["done", "Выполнено"], ["dismissed", "Отклонить"]].map(([status, label]) => <Button key={status} size="sm" variant={status === "open" ? "primary" : "outline"} disabled={busy} onClick={() => void save({ action: "task", id: task.id, status, assignedTo: assigned, dueDate: date || null })}>{label}</Button>)}</div></article>;
}

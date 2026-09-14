"use client";

import { Select } from "@/components/ui/select";

import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Search, ShieldCheck, UsersRound } from "@/components/ui/icons";
import styles from "./team.module.css";
import workflow from "@/components/shared/workflow.module.css";
import { Modal } from "@/components/ui/modal";
import { emptyContactAccess } from "@/lib/team-access";
import type { ContactAccessScope, ParticipantRecord, TeamRole } from "@/types/api";

type Option = { id: string; label: string; count: number };
type Invite = { id: string; label: string; role: TeamRole; expires_at: string; use_count: number; revoked_at: string | null };
type Overview = { participant: ParticipantRecord; canManage: boolean; members: ParticipantRecord[]; bases: Option[]; groups: { label: string; count: number }[]; invites: Invite[]; events: { id: string; actor_name: string; action: string; created_at: string; target_id: string; details: string }[] };
type Edit = { id?: string; label: string; targetParticipantId: string; role: TeamRole; accessScope: ContactAccessScope; status: "active" | "disabled"; updatedAt?: string };
const freshEdit = (): Edit => ({ label: "", targetParticipantId: "", role: "member", accessScope: emptyContactAccess(), status: "active" });
const date = (value: string) => new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
function scopeText(member: Pick<ParticipantRecord, "role" | "accessScope">, bases: Option[]) {
  if (member.role === "admin") return "Все базы · управление командой и подключениями";
  if (member.accessScope.all) return "Все контакты · свои рассылки";
  const names = [...member.accessScope.baseIds.map(id => bases.find(b => b.id === id)?.label ?? id), ...member.accessScope.groupTags];
  return names.length ? names.join(" · ") : "Доступ к контактам не назначен";
}
async function api(body?: unknown): Promise<Overview & { message: string; path?: string; expiresAt?: string; label?: string; role?: TeamRole; accessScope?: ContactAccessScope }> {
  const response = await fetch("/api/team", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json() as Overview & { message: string; path?: string; expiresAt?: string; label?: string; role?: TeamRole; accessScope?: ContactAccessScope; error?: string | { message?: string } };
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : data.error?.message || "Не удалось загрузить команду. Повторите попытку.");
  return data;
}
export function TeamManagementView() {
  const [now, setNow] = useState(0);
  useEffect(() => { const tick = () => setNow(Date.now()); const timer = window.setInterval(tick, 60000); const frame = window.requestAnimationFrame(tick); return () => { window.clearInterval(timer); window.cancelAnimationFrame(frame); }; }, []);
  const [data, setData] = useState<Overview | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [link, setLink] = useState<{ url: string; expiresAt: string; label: string; role: TeamRole; accessScope: ContactAccessScope } | null>(null);
  const [search, setSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const load = useCallback(async () => { try { setData(await api()); } catch (e) { setError(e instanceof Error ? e.message : "Ошибка загрузки."); } }, []);
  useEffect(() => { const frame = window.requestAnimationFrame(() => { void load(); }); return () => window.cancelAnimationFrame(frame); }, [load]);
  async function submit(body: unknown) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api(body);
      if (result.path && result.expiresAt) setLink({ url: new URL(result.path, window.location.origin).href, expiresAt: result.expiresAt, label: result.label || "Новый коллега", role: result.role || "member", accessScope: result.accessScope || emptyContactAccess() });
      setNotice(result.message); setEdit(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Изменение не сохранено."); }
    finally { setBusy(false); }
  }
  function openEdit(member?: ParticipantRecord) {
    setError(""); setGroupSearch("");
    setEdit(member ? { id: member.id, label: member.displayName, targetParticipantId: "", role: member.role, accessScope: { ...member.accessScope }, status: member.status, updatedAt: member.updatedAt } : freshEdit());
  }
  function toggle(key: "baseIds" | "groupTags", id: string) {
    setEdit(current => current ? { ...current, accessScope: { ...current.accessScope, [key]: current.accessScope[key].includes(id) ? current.accessScope[key].filter(v => v !== id) : [...current.accessScope[key], id] } } : current);
  }
  const filtered = data?.members.filter(m => `${m.displayName} ${m.login}`.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru"))) ?? [];
  return <div className={`${workflow.page} ${styles.page} mx-auto w-full max-w-6xl`}>
    <header className={styles.header}>
      <div><h1 className="text-3xl font-semibold tracking-tight">Команда и доступ</h1></div>
      {data?.canManage && <button className="btn btn-primary gap-2" onClick={() => openEdit()}><Plus className="size-6" aria-hidden />Пригласить коллегу</button>}
    </header>
    {error && !edit && <div role="alert" className="rounded-xl bg-[var(--danger-subtle)] p-4 text-sm text-[var(--danger)]">{error} <button className="underline" onClick={() => { setError(""); void load(); }}>Повторить</button></div>}
    {notice && <p role="status" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">{notice}</p>}
    {link && <section className={`${workflow.record} space-y-3`}><h2 className="font-semibold">Приглашение: {link.label}</h2><p className="text-sm">{scopeText(link, data?.bases ?? [])}</p><p className="text-sm text-[var(--text-muted)]">Один вход по приглашению · до {date(link.expiresAt)}. Передайте ссылку нужному коллеге; по ней он получит выбранную роль и доступ.</p><div className="flex flex-wrap gap-2"><input aria-label="Ссылка приглашения" readOnly value={link.url} onFocus={e => e.target.select()} className="input min-w-0 flex-1" /><button className="btn btn-secondary gap-2" onClick={async () => { try { await navigator.clipboard.writeText(link.url); setNotice("Ссылка скопирована."); } catch { setError("Выделите ссылку и скопируйте её вручную."); } }}><Copy aria-hidden className="size-6" />Копировать</button></div></section>}
    {!data ? !error && <p role="status" className={styles.loading}><UsersRound aria-hidden className="size-7" />Загружаем команду…</p> : <>
      {!data.canManage && <div className={`${workflow.record} ${styles.info}`}><h2 className="font-semibold">Ваш доступ</h2><p className="mt-2 text-sm">{scopeText(data.participant, data.bases)}</p><p className="mt-2 text-sm text-[var(--text-muted)]">Изменить назначения и пригласить коллег может администратор команды.</p></div>}
      <section className={styles.members}>
        <div className={workflow.toolbar}><h2 className={styles.listTitle}><span className={workflow.metricIcon}><UsersRound className="size-7" aria-hidden /></span>Участники <span className={styles.count}>{data.members.length}</span></h2><label className={styles.search}><Search aria-hidden className="size-6" /><span className="sr-only">Найти участника</span><input className="input" placeholder="Имя или логин" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
        <div className={styles.memberList}>{filtered.map(member => <div key={member.id} className={styles.member} data-current={member.id === data.participant.id || undefined}>
          <span className={styles.avatar} style={{ background: member.color }}>{member.displayName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{member.displayName}</h3>{member.id === data.participant.id && <span className="text-xs text-[var(--text-muted)]">Вы</span>}<span className={styles.status} data-tone={member.status === "disabled" ? "neutral" : !member.login ? "warning" : member.role === "admin" ? "primary" : "success"}>{member.status === "disabled" ? "Отключён" : member.login ? member.role === "admin" ? "Администратор" : "Сотрудник" : "Без аккаунта"}</span></div><p className="mt-1 text-sm text-[var(--text-muted)]">{member.login ? `@${member.login}` : "Ответственный в базе; ещё не зарегистрирован"}</p><p className="mt-2 break-words text-sm">{scopeText(member, data.bases)}</p></div>
          {data.canManage && <div className={styles.actions}><button className="btn btn-secondary btn-sm" onClick={() => openEdit(member)}>Настроить доступ</button>{!member.login && <button className="btn btn-secondary btn-sm" onClick={() => { openEdit(); setEdit({ ...freshEdit(), label: member.displayName, targetParticipantId: member.id, accessScope: { all: false, baseIds: [member.id], groupTags: [] } }); }}>Пригласить</button>}</div>}
        </div>)}{!filtered.length && <p className={styles.empty} role="status"><Search aria-hidden className="size-8" />Участник не найден.</p>}</div>
      </section>
      <div className="grid gap-5 md:grid-cols-2"><section className={`${workflow.record} ${styles.info}`}><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck aria-hidden className="size-7" />Как работает доступ</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--text-muted)]"><li>Администратор управляет всеми данными, участниками и подключениями.</li><li>Сотрудник работает с назначенными контактами и своими рассылками. Шаблоны и материалы общие.</li><li>База — контакты выбранного ответственного. Группа — контакты с выбранной меткой. Назначения складываются.</li><li>Новые контакты в назначенной базе или группе становятся доступны автоматически. После переноса контакта доступ пересчитывается.</li></ul></section>
      <section className={`${workflow.record} ${styles.info}`}><h2 className="font-semibold">Отзыв доступа</h2><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">При сужении доступа запланированные рассылки сотрудника отменяются. Уже переданные провайдеру письма отозвать нельзя. Отключение аккаунта завершает его сессии; контакты и история сохраняются.</p><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">Доступ существовавших аккаунтов сохранён. Администратор может заменить полный доступ конкретными назначениями.</p></section></div>
      {data.canManage && <>
        <section className={`${workflow.record} ${styles.info}`}><h2 className="font-semibold">Приглашения</h2><div className="mt-3 divide-y divide-[var(--border)]">{data.invites.map(invite => { const available = !invite.revoked_at && !invite.use_count && Date.parse(invite.expires_at) > now; return <div className={styles.invite} key={invite.id}><div><p className="text-sm font-medium">{invite.label || "Новый коллега"} · {invite.role === "admin" ? "Администратор" : "Сотрудник"}</p><p className={`${styles.status} mt-2`} data-tone={invite.use_count ? "success" : available ? "primary" : "neutral"}>{invite.use_count ? "Использовано" : invite.revoked_at ? "Отменено" : available ? `Действует до ${date(invite.expires_at)}` : "Срок истёк"}</p></div>{available && <button disabled={busy} className="btn btn-secondary btn-sm" onClick={() => void submit({ action: "revoke_invite", id: invite.id })}>Отменить приглашение</button>}</div>; })}{!data.invites.length && <p className="py-3 text-sm text-[var(--text-muted)]">Пока нет приглашений.</p>}</div></section>
        <details className={`${workflow.record} ${styles.info}`}><summary className="cursor-pointer font-semibold">Журнал изменений доступа</summary><div className="mt-3 space-y-3">{data.events.map(event => { let detail: { label?: string; after?: { role: TeamRole; status: string } } = {}; try { detail = JSON.parse(event.details); } catch { /* Legacy event. */ } return <p key={event.id} className="text-sm leading-6"><span className="text-[var(--text-muted)]">{date(event.created_at)}</span> · {event.actor_name || "Администратор"}: {event.action === "invite_created" ? `создал приглашение ${detail.label || ""}` : event.action === "invite_revoked" ? "отменил приглашение" : `изменил доступ: ${data.members.find(m => m.id === event.target_id)?.displayName || "участник"} (${detail.after?.status === "disabled" ? "отключён" : detail.after?.role === "admin" ? "администратор" : "сотрудник"})`}</p>; })}{!data.events.length && <p className="text-sm text-[var(--text-muted)]">Изменений пока нет.</p>}</div></details>
      </>}
    </>}
    <Modal className={styles.dialog} open={Boolean(edit)} onOpenChange={open => { if (!open && !busy) setEdit(null); }} title={edit?.id ? `Доступ: ${edit.label}` : "Пригласить коллегу"} size="xl" footer={<div className="flex flex-wrap justify-end gap-2"><button className="btn btn-secondary" disabled={busy} onClick={() => setEdit(null)}>Отмена</button><button className="btn btn-primary" disabled={busy} onClick={() => edit && void submit({ ...edit, action: edit.id ? "update_member" : "invite" })}>{busy ? "Сохраняем…" : edit?.id ? "Сохранить доступ" : "Создать приглашение"}</button></div>}>
      {edit && data && <div className={`${styles.editor} space-y-5`}>
        {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
        {!edit.id && <><label className="block text-sm font-medium">Имя коллеги<input className="input mt-2" value={edit.label} maxLength={150} onChange={e => setEdit({ ...edit, label: e.target.value })} placeholder="Например, Мария Иванова" /></label><label className="block text-sm font-medium">Аккаунт<Select className="input mt-2" value={edit.targetParticipantId} onChange={e => { const member = data.members.find(m => m.id === e.target.value); setEdit({ ...edit, targetParticipantId: e.target.value, label: member?.displayName ?? edit.label }); }}><option value="">Новый участник</option>{data.members.filter(m => !m.login).map(m => <option key={m.id} value={m.id}>Подключить: {m.displayName}</option>)}</Select></label></>}
        <label className="block text-sm font-medium">Роль<Select className="input mt-2" value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value as TeamRole })}><option value="member">Сотрудник — контакты и свои рассылки</option><option value="admin">Администратор — все данные и управление</option></Select></label>
        {edit.role === "admin" ? <p className="rounded-xl bg-[var(--surface-subtle)] p-4 text-sm leading-6">Администратор получает доступ ко всем базам, рассылкам, участникам и подключениям.</p> : <fieldset className="min-w-0 space-y-4"><legend className="mb-2 text-sm font-semibold">Контакты</legend><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={edit.accessScope.all} onChange={e => setEdit({ ...edit, accessScope: { ...edit.accessScope, all: e.target.checked } })} />Все контакты команды</label>{!edit.accessScope.all && <>
          <p className="text-sm text-[var(--text-muted)]">Выберите базы и группы. Без назначений сотруднику доступны только общие материалы.</p>
          <div className="grid gap-4 sm:grid-cols-2"><fieldset className="min-w-0"><legend className="mb-2 text-sm font-semibold">Базы ответственных</legend><div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">{data.bases.map(base => <label key={base.id} className={styles.choice}><input type="checkbox" className="mt-1" checked={edit.accessScope.baseIds.includes(base.id)} onChange={() => toggle("baseIds", base.id)} /><span className="min-w-0 [overflow-wrap:anywhere]">{base.label}<span className="block text-xs text-[var(--text-muted)]">{base.count} контактов</span></span></label>)}</div></fieldset>
          <fieldset className="min-w-0"><legend className="mb-2 text-sm font-semibold">Группы (метки)</legend><input aria-label="Поиск группы" className="input mb-2" placeholder="Название группы" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} /><div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">{[...data.groups, ...edit.accessScope.groupTags.filter(tag => !data.groups.some(g => g.label === tag)).map(label => ({ label, count: 0 }))].filter(g => g.label.toLocaleLowerCase("ru").includes(groupSearch.toLocaleLowerCase("ru"))).map(g => <label key={g.label} className={styles.choice}><input type="checkbox" className="mt-1" checked={edit.accessScope.groupTags.includes(g.label)} onChange={() => toggle("groupTags", g.label)} /><span className="min-w-0 [overflow-wrap:anywhere]">{g.label}<span className="block text-xs text-[var(--text-muted)]">{g.count} контактов</span></span></label>)}{!data.groups.length && <p className="p-2 text-sm text-[var(--text-muted)]">Добавьте метки контактам, чтобы назначать группы.</p>}</div></fieldset></div>
          <p className="text-sm font-medium">Выбрано баз: {edit.accessScope.baseIds.length} · групп: {edit.accessScope.groupTags.length}</p>
        </>}</fieldset>}
        {edit.id && <><label className="block text-sm font-medium">Состояние аккаунта<Select className="input mt-2" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value as Edit["status"] })}><option value="active">Активен</option><option disabled={edit.id === data.participant.id} value="disabled">Отключён</option></Select></label><p className="rounded-xl bg-[var(--surface-subtle)] p-4 text-sm leading-6">Если доступ сужается, запланированные рассылки этого сотрудника будут отменены. Уже отправленные письма и история сохранятся.</p></>}
      </div>}
    </Modal>
  </div>;
}

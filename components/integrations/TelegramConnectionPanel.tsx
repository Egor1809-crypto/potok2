"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Copy, ExternalLink, MessageCircleMore, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Alert, Badge, Button, FormField, Input, Modal, buttonVariants } from "@/components/ui";
import type { TelegramConnectionInfo } from "@/types/telegram";

export function TelegramConnectionPanel({ open, onOpenChange, onChange, updatedAt }: {
  open: boolean; onOpenChange: (open: boolean) => void; onChange: () => void; updatedAt?: string;
}) {
  const [info, setInfo] = React.useState<TelegramConnectionInfo | null>(null);
  const [token, setToken] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/integrations/telegram", { cache: "no-store" });
      const body = await response.json() as TelegramConnectionInfo & { error?: string };
      if (!response.ok) throw new Error(body.error || "Не удалось загрузить Telegram.");
      setInfo(body); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось загрузить Telegram."); }
  }, []);
  React.useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load, updatedAt]);
  React.useEffect(() => {
    if (!info?.connected) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15_000);
    return () => window.clearInterval(timer);
  }, [info?.connected, load]);
  function closeSetup() { if (!busy) { setToken(""); onOpenChange(false); } }
  async function act(action: "connect" | "check" | "disconnect") {
    if (busy) return;
    setBusy(action); setError("");
    try {
      const response = await fetch("/api/integrations/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(action === "connect" ? { token } : {}) }) });
      const body = await response.json() as TelegramConnectionInfo & { error?: string };
      if (!response.ok) throw new Error(body.error || "Не удалось выполнить действие.");
      setInfo(body); setCopied(false); setConfirmDisconnect(false); onChange();
      if (action === "connect") { setToken(""); onOpenChange(false); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие."); }
    finally { setBusy(""); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(info?.subscribeUrl ?? ""); setCopied(true); }
    catch { setError("Не удалось скопировать ссылку. Выделите её в поле и скопируйте вручную."); }
  }
  const problem = error ? <Alert tone="danger" title="Telegram">{error}</Alert> : null;
  return (
    <section id="telegram-connection" className="card scroll-mt-24 overflow-hidden" aria-labelledby="telegram-connection-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-subtle text-text-strong"><MessageCircleMore aria-hidden="true" className="size-5" /></span>
          <div><h2 id="telegram-connection-title" className="text-[17px] font-semibold text-text-strong">Рассылки в Telegram</h2><p className="mt-1 text-[13px] text-text-muted">Бот, подписчики и отправка из Потока</p></div>
        </div>
        <Badge variant={info?.connected ? "success" : "neutral"} dot>{info?.connected ? "Подключён" : info ? "Не подключён" : "Загружаем…"}</Badge>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        {!open && problem}
        {info?.connected ? <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="font-semibold text-text-strong">{info.displayName}</p><a className="mt-1 inline-flex items-center gap-1 text-[13px] text-primary underline underline-offset-4" href={`https://t.me/${info.username}`} target="_blank" rel="noreferrer">@{info.username}<ExternalLink aria-hidden="true" className="size-3" /></a></div>
            <div className="text-right"><p className="text-2xl font-semibold tabular-nums text-text-strong">{info.subscribers.toLocaleString("ru-RU")}</p><p className="text-[12px] text-text-muted">доступно для рассылки</p></div>
          </div>
          <div className="rounded-xl border border-border bg-surface-subtle p-4">
            <FormField label="Ссылка для подписки" htmlFor="telegram-subscribe-url" hint="Отправьте её аудитории или разместите на сайте. Человек откроет бота и подтвердит подписку — контакт появится в Потоке автоматически.">
              <div className="flex flex-col gap-2 sm:flex-row"><Input id="telegram-subscribe-url" readOnly value={info.subscribeUrl} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1" /><Button variant="outline" onClick={() => void copyLink()} leadingIcon={<Copy aria-hidden="true" className="size-4" />}>{copied ? "Скопировано" : "Скопировать"}</Button></div>
            </FormField>
          </div>
          {info.subscribers === 0 && <p className="text-[13px] leading-5 text-text-muted">Пока подписчиков нет. Откройте ссылку и подпишитесь сами, чтобы проверить подключение. Счётчик обновляется автоматически.</p>}
          <div className="flex flex-wrap gap-2">
            {info.subscribers > 0 ? <Link href="/campaigns/new?channel=telegram&provider_telegram=telegram-bot-api&audience=telegram" className={buttonVariants({ variant: "primary" })}>Создать рассылку<ArrowRight aria-hidden="true" className="size-4" /></Link> : <a href={info.subscribeUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "primary" })}>Открыть бота<ExternalLink aria-hidden="true" className="size-4" /></a>}
            <Button variant="outline" disabled={Boolean(busy)} loading={busy === "check"} onClick={() => void act("check")} leadingIcon={<RefreshCw aria-hidden="true" className="size-4" />}>Проверить</Button>
            <Button variant="ghost" disabled={Boolean(busy)} onClick={() => setConfirmDisconnect(true)} leadingIcon={<Unplug aria-hidden="true" className="size-4" />}>Отключить</Button>
          </div>
          <p className="text-[12px] leading-5 text-text-muted">{info.message} Команда /stop отменяет подписку. Telegram-сообщения поддерживают текст, персонализацию и PDF.</p>
        </> : <>
          <ol className="grid gap-4 text-[13px] leading-5 sm:grid-cols-3">
            <li><p className="font-semibold text-text-strong">1. Создайте бота</p><p className="mt-1 text-text-muted">Откройте <a className="text-primary underline underline-offset-4" href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a>, отправьте /newbot и скопируйте токен.</p></li>
            <li><p className="font-semibold text-text-strong">2. Подключите к Потоку</p><p className="mt-1 text-text-muted">Вставьте токен. Мы проверим бота и настроим приём подписок.</p></li>
            <li><p className="font-semibold text-text-strong">3. Пригласите подписчиков</p><p className="mt-1 text-text-muted">Поделитесь ссылкой. Подтвердившие подписку получатели появятся в контактах.</p></li>
          </ol>
          {info?.username && <p className="text-[13px] text-text-muted">@{info.username}: {info.message}</p>}
          {info && !info.configured && <Alert tone="warning" title="Подключение временно недоступно">Администратору платформы нужно настроить защищённое хранилище токенов.</Alert>}
          <div className="flex flex-wrap items-center gap-3"><Button onClick={() => { setError(""); onOpenChange(true); }} disabled={!info?.configured}>Подключить Telegram</Button>{info?.username && <Button variant="outline" loading={busy === "check"} disabled={Boolean(busy)} onClick={() => void act("check")}>Повторить проверку</Button>}<Button variant="ghost" onClick={() => void load()} disabled={Boolean(busy)}>Обновить статус</Button><p className="text-[12px] text-text-muted">Рассылки от имени бота — только подписавшимся пользователям.</p></div>
        </>}
      </div>
      <Modal open={open} onOpenChange={value => { if (!value) closeSetup(); }} title="Подключить Telegram" description="Понадобится токен бота из BotFather. Имя и ссылку Поток определит автоматически." size="md">
        <form className="space-y-5" onSubmit={event => { event.preventDefault(); void act("connect"); }}>
          {problem}
          <FormField label="Токен бота" htmlFor="telegram-bot-token" hint="Не пароль от вашего Telegram. Получить токен можно у @BotFather командой /newbot или /token.">
            <Input id="telegram-bot-token" type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder="Вставьте токен из BotFather" required maxLength={130} disabled={Boolean(busy)} />
          </FormField>
          <p className="flex items-start gap-2 text-[12px] leading-5 text-text-muted"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Токен хранится зашифрованным на сервере и не показывается после подключения. Используйте отдельного бота, который не подключён к другому сервису.</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" disabled={Boolean(busy)} onClick={closeSetup}>Отмена</Button><Button type="submit" disabled={!token.trim() || Boolean(busy)} loading={busy === "connect"} loadingText="Подключаем…">Подключить бота</Button></div>
        </form>
      </Modal>
      <Modal open={confirmDisconnect} onOpenChange={value => !busy && setConfirmDisconnect(value)} title="Отключить бота?" description="Рассылки через него остановятся. Подписчики сохранятся и будут доступны при повторном подключении этого же бота." size="sm" footer={<><Button variant="ghost" disabled={Boolean(busy)} onClick={() => setConfirmDisconnect(false)}>Отмена</Button><Button disabled={Boolean(busy)} loading={busy === "disconnect"} onClick={() => void act("disconnect")}>Отключить</Button></>}><p className="text-[13px] text-text-muted">@{info?.username}</p>{problem}</Modal>
    </section>
  );
}

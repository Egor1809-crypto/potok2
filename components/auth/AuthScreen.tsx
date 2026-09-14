"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Eye, EyeOff, Mail, Presentation, Image as ImageIcon } from "@/components/ui/icons";
import { useSearchParams } from "next/navigation";

import { BrandMark } from "@/components/layout/brand-mark";

import { clearAccountDrafts } from "@/lib/browser-session";
import { authFeedback } from "@/lib/auth-feedback";
import styles from "./AuthScreen.module.css";

const TEAM_NAME = "ТехнологИИ Права";

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(searchParams.get("invite") || "");
  const [showPassword, setShowPassword] = useState(false);
  const [yandexAvailable, setYandexAvailable] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/yandex/status", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(async response => { if (response.ok) { const body = await response.json() as { configured?: boolean }; setYandexAvailable(body.configured === true); } })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => { clearAccountDrafts(); return () => activeRequest.current?.abort(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(mode === "register"
          ? { team: TEAM_NAME, displayName, login, password, inviteCode: inviteCode || undefined }
          : { login, password }),
      });
      let payload: { error?: string };
      try { payload = await response.json(); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new Error("Сервер временно недоступен. Попробуйте войти ещё раз.");
      }
      if (!response.ok) throw new Error(payload.error || "Не удалось войти. Попробуйте ещё раз.");
      const next = searchParams.get("next");
      const destination = new URL(next?.startsWith("/") ? next : "/dashboard", window.location.origin);
      // Start the authenticated page with the new cookie, without racing a
      // client-side redirect against a refresh of the old login route.
      window.location.replace(destination.origin === window.location.origin ? destination.pathname + destination.search + destination.hash : "/dashboard");
    } catch (submitError) {
      if (timedOut) setError("Сервер не ответил за 15 секунд. Попробуйте войти ещё раз — логин и пароль сохранены в форме.");
      else if (!controller.signal.aborted) setError(submitError instanceof TypeError ? "Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз." : submitError instanceof Error ? submitError.message : "Не удалось выполнить операцию.");
    } finally {
      window.clearTimeout(timeout);
      activeRequest.current = null;
      setBusy(false);
    }
  }

  const isRegister = mode === "register";
  const visibleError = error || authFeedback[searchParams.get("auth_error") || ""] || "";
  const contextParams = new URLSearchParams();
  if (searchParams.get("next")) contextParams.set("next", searchParams.get("next")!);
  if (searchParams.get("invite")) contextParams.set("invite", searchParams.get("invite")!);
  const contextSuffix = contextParams.size ? `?${contextParams}` : "";
  const yandexParams = new URLSearchParams({ intent: isRegister ? "register" : "login", next: searchParams.get("next") || "/dashboard" });
  if (inviteCode) yandexParams.set("invite", inviteCode);
  return <main className={styles.page}>
    <aside className={styles.story} aria-label="Творческая студия Поток">
      <BrandMark href="/" className={styles.storyBrand} />
      <div className={styles.storyCopy}><span>Ваше пространство для хороших идей</span><h2>Всё начинается<br />с одной <em>идеи.</em></h2><p>Соберите письмо, расскажите историю в слайдах или найдите нужный образ. Остальное сложится в Поток.</p>
        <div className={styles.art} aria-hidden><div /><div /><div><small>НОВЫЙ ПРОЕКТ</small><strong>Самое важное.<br />В вашей<br />подаче.</strong><i /></div></div>
      </div>
      <div className={styles.storyFooter}><span><Mail aria-hidden />Письма</span><span><Presentation aria-hidden />Презентации</span><span><ImageIcon aria-hidden />Изображения</span></div>
    </aside>
    <section className={styles.content}>
      <Link href="/" className={styles.back}><ArrowLeft aria-hidden className="size-5" />На главную</Link>
      <div className={styles.mobileBrand}><BrandMark href="/" /></div>
      <div className={styles.formWrap}>
        <nav className={styles.mode} aria-label="Вход и регистрация"><Link href={`/login${contextSuffix}`} aria-current={!isRegister ? "page" : undefined}>Вход</Link><Link href={`/register${contextSuffix}`} aria-current={isRegister ? "page" : undefined}>Регистрация</Link></nav>
        <h1>{isRegister ? "Присоединяйтесь к Потоку" : "С возвращением"}</h1>
        <p className={styles.intro}>{isRegister ? "Создайте своё пространство. Приглашайте команду, когда будете готовы." : "Войдите, чтобы продолжить работу над проектами."}</p>
        {yandexAvailable && <><a href={`/api/auth/yandex/start?${yandexParams}`} className={styles.yandex}><span aria-hidden className={styles.yandexMark}>Я</span>{isRegister ? "Зарегистрироваться с Яндекс ID" : "Войти с Яндекс ID"}</a><div className={styles.divider}>или с логином и паролем</div></>}
        <form className={styles.form} onSubmit={submit} aria-busy={busy}>
          {isRegister && <label className={styles.field}>Ваше имя<input name="name" autoComplete="name" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Имя и фамилия" required minLength={2} maxLength={100} className={styles.input} /></label>}
          <label className={styles.field}>Логин<input name="username" autoComplete="username" value={login} onChange={event => setLogin(event.target.value)} placeholder="Например, egor.shabalin" required minLength={3} maxLength={40} className={styles.input} /></label>
          <label className={styles.field}>Пароль<span className={styles.password}><input name="password" autoComplete={isRegister ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={10} maxLength={128} className={styles.input} aria-describedby={isRegister ? "password-hint" : undefined} /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} aria-pressed={showPassword}>{showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}</button></span>{isRegister && <small id="password-hint">От 10 символов, хотя бы одна буква и цифра.</small>}</label>
          {isRegister && <label className={styles.field}>Код приглашения (необязательно)<input name="invite" value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="POTOK-…" className={styles.input} /><small>Оставьте пустым, чтобы создать отдельное пространство.</small></label>}
          {visibleError && <p role="alert" className={styles.error}>{visibleError}</p>}
          <button disabled={busy} className={styles.submit}>{busy ? isRegister ? "Создаём аккаунт…" : "Входим…" : isRegister ? "Создать аккаунт" : "Войти"}<ArrowRight aria-hidden className="size-5" /></button>
        </form>
        <p className={styles.help}>{isRegister ? <>Уже зарегистрированы? <Link href={`/login${contextSuffix}`}>Войти в аккаунт</Link></> : <>Нет аккаунта? <Link href={`/register${contextSuffix}`}>Зарегистрироваться</Link></>}</p>
      </div>
      <footer className={styles.footer}><span>© {new Date().getFullYear()} Поток</span><span>Письма. Презентации. Изображения.</span></footer>
    </section>
  </main>;
}

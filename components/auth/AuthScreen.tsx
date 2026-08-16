"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { BrandMark } from "@/components/layout/brand-mark";

const TEAM_NAME = "ТехнологИИ Права";

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstAccount, setFirstAccount] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setFirstAccount(Boolean((payload as { firstAccountAvailable?: boolean }).firstAccountAvailable)))
      .catch(() => setFirstAccount(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register"
          ? { team: TEAM_NAME, login, password, inviteCode: firstAccount ? undefined : inviteCode }
          : { login, password }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Не удалось войти.");
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось выполнить операцию.");
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === "register";
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr] bg-background text-text-strong">
      <section className="hidden border-r border-border bg-[#15121d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <BrandMark href="/" className="[&_span]:text-white" />
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-[#bca8ff]">Одна команда — одна точная база</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.04] tracking-[-0.05em]">Контакты не теряются и не дублируются.</h1>
          <p className="mt-6 text-lg leading-8 text-white/75">Каждый участник работает под своим логином. Цвет автора сразу показывает, кто добавил контакт, а общая проверка защищает базу от повторов.</p>
        </div>
        <div className="flex gap-6 text-sm text-white/65"><span>10+ участников</span><span>10 000 контактов</span><span>Полный доступ для команды</span></div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[480px]">
          <div className="lg:hidden"><BrandMark href="/" /></div>
          <div className="mt-10 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:mt-0"><UsersRound aria-hidden className="size-6" /></div>
          <p className="mt-7 text-sm font-semibold text-primary">Команда «{TEAM_NAME}»</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">{isRegister ? "Создать аккаунт" : "Войти в Поток"}</h2>
          <p className="mt-3 text-base leading-7 text-text-muted">
            {isRegister
              ? firstAccount ? "Вы активируете первый аккаунт команды." : "Регистрация доступна по одноразовому приглашению коллеги."
              : "Продолжите работу с общей базой команды."}
          </p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            {isRegister && <label className="block"><span className="mb-2 block text-sm font-semibold">Команда</span><input value={TEAM_NAME} readOnly className="h-12 w-full rounded-xl border border-border bg-surface-subtle px-4 text-base font-medium" /></label>}
            <label className="block"><span className="mb-2 block text-sm font-semibold">Логин</span><input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Например, egor" required minLength={3} className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold">Пароль</span><span className="relative block"><LockKeyhole aria-hidden className="absolute left-4 top-3.5 size-5 text-text-muted" /><input autoComplete={isRegister ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} className="h-12 w-full rounded-xl border border-border bg-surface pl-12 pr-12 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg hover:bg-surface-subtle">{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span>{isRegister && <span className="mt-2 block text-sm text-text-muted">Минимум 10 символов, хотя бы одна буква и цифра.</span>}</label>
            {isRegister && firstAccount === false && <label className="block"><span className="mb-2 block text-sm font-semibold">Код приглашения</span><input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} required placeholder="POTOK-..." className="h-12 w-full rounded-xl border border-border bg-surface px-4 font-mono text-base uppercase outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>}
            {error && <div role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">{error}</div>}
            <button disabled={busy || (isRegister && firstAccount === null)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-base font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-60">{busy ? "Подождите…" : isRegister ? "Создать аккаунт" : "Войти"}<ArrowRight aria-hidden className="size-5" /></button>
          </form>
          <p className="mt-7 text-center text-sm text-text-muted">{isRegister ? "Уже есть аккаунт?" : "Вас пригласили в команду?"} <Link className="font-semibold text-primary hover:underline" href={isRegister ? "/login" : "/register"}>{isRegister ? "Войти" : "Зарегистрироваться"}</Link></p>
        </div>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COOKIE_PREFERENCE_KEY, COOKIE_PREFERENCE_VERSION, COOKIE_PREFERENCE_EVENT, COOKIE_SETTINGS_EVENT, readCookiePreferences, type CookiePreferences } from "@/lib/cookie-preferences";
import styles from "./Privacy.module.css";

export function CookieSettingsButton({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}>Настроить cookies</button>;
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<CookiePreferences["choice"] | null>(null);
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const focusOnOpen = useRef(false);

  useEffect(() => {
    const sync = () => {
      const saved = readCookiePreferences();
      setChoice(saved?.choice ?? null);
      setOpen(!saved);
    };
    const show = () => {
      trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      focusOnOpen.current = true;
      setChoice(readCookiePreferences()?.choice ?? null);
      setOpen(true);
      // The banner might already be open when its footer control is used.
      heading.current?.focus();
    };
    const storage = (event: StorageEvent) => { if (event.key === COOKIE_PREFERENCE_KEY || event.key === null) sync(); };
    sync();
    window.addEventListener(COOKIE_SETTINGS_EVENT, show);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(COOKIE_SETTINGS_EVENT, show); window.removeEventListener("storage", storage); };
  }, []);
  useEffect(() => { if (open && focusOnOpen.current) { heading.current?.focus(); focusOnOpen.current = false; } }, [open]);

  function save(next: CookiePreferences["choice"]) {
    const preference: CookiePreferences = { version: COOKIE_PREFERENCE_VERSION, choice: next, savedAt: Date.now() };
    try { window.localStorage.setItem(COOKIE_PREFERENCE_KEY, JSON.stringify(preference)); }
    catch { setNotice("Выбор действует до закрытия страницы. Браузер не разрешил сохранить его для следующих посещений."); }
    setChoice(next);
    setOpen(false);
    window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCE_EVENT, { detail: preference }));
    trigger.current?.focus();
    trigger.current = null;
  }

  return <>
    {open && <section className={styles.banner} aria-labelledby="cookie-title" aria-describedby="cookie-description">
      <h2 ref={heading} tabIndex={-1} id="cookie-title">Настройки cookies</h2>
      <p id="cookie-description">Используем cookies для входа и безопасности. Рекламных и аналитических cookies сейчас нет.</p>
      <details className={styles.details}><summary>Подробнее о данных</summary><p>Сессия входа — до 30 дней, защита входа через Яндекс — 10 минут. Ваш выбор хранится на этом устройстве 180 дней. Аналитические и рекламные cookies сейчас не используются; их подключение потребует нового согласия.</p><p>Согласие на обработку данных аккаунта запрашивается отдельно при регистрации.</p><div className={styles.bannerLinks}><Link href="/cookies">Политика cookies</Link><Link href="/privacy">Персональные данные</Link></div>{choice && <p>Текущий выбор: {choice === "accepted" ? "принято" : "дополнительные cookies отклонены"}.</p>}</details>

      <div className={styles.bannerActions}><button type="button" aria-label="Отклонить дополнительные cookies" onClick={() => save("rejected")}>Отклонить</button><button type="button" onClick={() => save("accepted")}>Принять</button></div>
    </section>}
    <div role="status" className={notice ? styles.storageNotice : styles.srOnly}>{notice}{notice && <button type="button" onClick={() => setNotice("")}>Закрыть</button>}</div>
  </>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "@/components/ui/icons";
import { BrandMark } from "@/components/layout/brand-mark";
import styles from "./Marketing.module.css";
const links = [["Возможности", "#product"], ["Как работает", "#workflow"], ["Вопросы", "#questions"]];
export function MarketingHeader() {
  const [open, setOpen] = useState(false);const button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);button.current?.focus()}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[open]);
  return <header className={styles.header}><div><BrandMark href="/" /><nav aria-label="Возможности Потока">{links.map(([label,href])=><a key={href} href={href}>{label}</a>)}</nav><div className={styles.headerActions}><Link href="/login">Войти</Link><Link className={styles.smallPrimary} href="/register">Начать<ArrowRight aria-hidden className="size-5" /></Link></div><button ref={button} type="button" aria-label={open?"Закрыть меню":"Открыть меню"} aria-expanded={open} aria-controls="marketing-menu" className={styles.menuButton} onClick={()=>setOpen(v=>!v)}>{open?<X aria-hidden />:<Menu aria-hidden />}</button></div>{open&&<nav id="marketing-menu" className={styles.mobileMenu} aria-label="Мобильное меню">{links.map(([label,href])=><a key={href} href={href} onClick={()=>setOpen(false)}>{label}</a>)}<Link href="/login">Войти</Link><Link href="/register">Создать аккаунт</Link></nav>}</header>;
}

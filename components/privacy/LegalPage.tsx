import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { legalConfig } from "@/config/legal";
import marketing from "@/components/marketing/Marketing.module.css";
import styles from "./Legal.module.css";

export function LegalPage({ title, intro, children, draft = true }: { title: string; intro: string; children: ReactNode; draft?: boolean }) {
  return <div className={marketing.site}><a className={marketing.skip} href="#main">К содержанию</a><MarketingHeader /><main id="main" className={styles.page}><Link href="/" className={styles.back}>← На главную</Link><span className={styles.eyebrow}>ПОТОК · ДОКУМЕНТЫ И ДАННЫЕ</span><h1>{title}</h1><p className={styles.intro}>{intro}</p><p className={styles.version}>Редакция от 15 сентября 2026 года</p>{draft && !legalConfig.approved && <aside className={styles.draft}><strong>Проект документа для проверки</strong><p>Реквизиты оператора и условия обработки требуют подтверждения владельцем сервиса. Эта редакция пока не утверждена.</p></aside>}<div className={styles.body}>{children}</div><nav className={styles.related} aria-label="Связанные документы"><Link href="/privacy">Персональные данные</Link><Link href="/consent">Согласие</Link><Link href="/cookies">Cookies</Link><Link href="/terms">Условия использования</Link></nav></main><MarketingFooter /></div>;
}
export function OperatorDetails() {
  return <section><h2>Оператор и обращения</h2>{legalConfig.operatorName ? <p>{legalConfig.operatorName}. ИНН {legalConfig.inn}.{legalConfig.ogrn && <> ОГРН {legalConfig.ogrn}.</>}{legalConfig.address && <> Адрес: {legalConfig.address}.</>}</p> : <p>Полное наименование, ИНН, ОГРН и адрес оператора будут указаны после подтверждения владельцем сервиса.</p>}<p>По вопросам данных и работы сервиса: <a href={`mailto:${legalConfig.privacyEmail}`}>{legalConfig.privacyEmail}</a>. Укажите логин и суть обращения. Не отправляйте пароль или полный список ваших контактов.</p></section>;
}

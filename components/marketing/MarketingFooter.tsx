import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";
import { legalConfig } from "@/config/legal";
import { brandConfig } from "@/config/brand";
import { CookieSettingsButton } from "@/components/privacy/CookieConsent";
import styles from "./Marketing.module.css";

export function MarketingFooter() {
  return <footer id="contacts" className={styles.footer}>
    <div className={styles.footerTop}>
      <div className={styles.footerBrand}><BrandMark href="/" /><p>Материалы и рассылки<br />для вашей команды.</p><span>Письма · Презентации · Изображения</span></div>
      <nav aria-label="Продукт"><h2>В Потоке</h2><Link href="/#product">Возможности</Link><Link href="/#workflow">Как работает</Link><Link href="/#questions">Вопросы и ответы</Link><Link href="/register">Создать аккаунт</Link><Link href="/login">Войти в аккаунт</Link></nav>
      <nav aria-label="Документы и данные"><h2>Документы и данные</h2><Link href="/privacy">Персональные данные</Link><Link href="/consent">Согласие на обработку</Link><Link href="/cookies">Политика cookies</Link><Link href="/terms">Условия использования</Link><CookieSettingsButton /></nav>
      <div className={styles.footerContact}><h2>Остаёмся на связи</h2><a href={`mailto:${brandConfig.supportEmail}`}>{brandConfig.supportEmail}<span aria-hidden> ↗</span></a><p>Помощь с аккаунтом, вопросы о сервисе и обращения по персональным данным.</p><a href={brandConfig.website}>ТехнологИИ Права ↗</a></div>
    </div>
    {legalConfig.operatorName && <div className={styles.footerLegal}><span>{legalConfig.operatorName} · ИНН {legalConfig.inn}{legalConfig.ogrn && <> · ОГРН {legalConfig.ogrn}</>}</span>{legalConfig.address && <span>{legalConfig.address}</span>}</div>}
    <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Поток</span><span>Рабочее пространство команды</span><a href="#main">Наверх ↑</a></div>
  </footer>;
}

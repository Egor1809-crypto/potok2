import Link from "next/link";
import { ArrowRight, Check, Mail, Presentation, Image as ImageIcon, Sparkles, Send, ChevronDown } from "@/components/ui/icons";
import { MarketingHeader } from "./MarketingHeader";
import { ProductPreview } from "./ProductPreview";
import { BrandMark } from "@/components/layout/brand-mark";
import { brandConfig } from "@/config/brand";
import styles from "./Marketing.module.css";

const steps = [
  ["01", "Сформулируйте идею", "Опишите задачу ИИ, выберите шаблон или загрузите готовый материал."],
  ["02", "Соберите материал", "Редактируйте текст, изображения и элементы прямо на холсте."],
  ["03", "Посмотрите свежим взглядом", "Арт-директор найдёт слабые места и предложит конкретные улучшения."],
  ["04", "Поделитесь результатом", "Экспортируйте презентацию или запланируйте отправку письма аудитории."],
];
const questions = [
  ["Можно работать с готовыми материалами?", "Да. Импортируйте письмо, загрузите презентацию в PowerPoint или PDF, выберите изображения из медиатеки. После импорта можно продолжить работу в конструкторе."],
  ["Что проверяет арт-директор?", "В письмах — текст, оформление и призыв к действию. В презентациях — отдельные слайды и логику всей истории. В фотографиях — композицию, цвет и читаемость будущего макета. Рекомендации остаются под вашим контролем."],
  ["Как отправляются рассылки?", "Подготовьте письмо, выберите контакты или сегмент и укажите время отправки. Поток передаст рассылку подключённому провайдеру, а календарь и история помогут следить за её состоянием."],
  ["Можно работать вместе с командой?", "Да. Участники работают под своими аккаунтами. Администратор управляет приглашениями и доступом к контактным базам."],
];
export function LandingPage() {
  return <div className={styles.site}>
    <a className={styles.skip} href="#main">К содержанию</a>
    <MarketingHeader />
    <main id="main">
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.intro}><span aria-hidden />Творческая студия для вашей команды</p>
          <h1>От первой идеи<br />до последнего<br /><em>штриха.</em></h1>
          <p className={styles.lead}>Письма, презентации и изображения — в одном Потоке. Создавайте с ИИ, доводите до ума и отправляйте тем, кому это важно.</p>
          <div className={styles.heroActions}><Link href="/register" className={styles.primary}>Начать работу<ArrowRight aria-hidden className="size-6" /></Link><a href="#product" className={styles.textLink}>Посмотреть возможности<span aria-hidden>↗</span></a></div>
          <div className={styles.heroNote}><Check aria-hidden className="size-5" />Шаблоны, редактор и арт-директор под рукой</div>
        </div>
        <ProductPreview />
      </section>
      <section id="product" className={styles.product}>
        <div className={styles.sectionHead}><h2>Три формата.<br /><span>Один подход к работе.</span></h2><p>Меньше переключений между сервисами.<br />Больше внимания тому, что вы создаёте.</p></div>
        <div className={styles.formats}>
          <article><span className={styles.formatIcon}><Mail aria-hidden /></span><h3>Письма, которые хочется открыть</h3><p>Собирайте макеты из блоков, добавляйте изображения и персонализацию. Проверьте результат перед отправкой.</p><a href="#workflow">От макета до рассылки<ArrowRight aria-hidden className="size-5" /></a><div className={styles.emailVisual} aria-hidden><span>ПРИГЛАШЕНИЕ</span><strong>Есть идея.<br />Давайте обсудим.</strong><i /><b>Открыть программу ↗</b></div></article>
          <article><span className={styles.formatIcon}><Presentation aria-hidden /></span><h3>Презентации с ясной мыслью</h3><p>Начните с шаблона или импортируйте PowerPoint и PDF. Редактируйте слайды и проверяйте всю историю целиком.</p><a href="#workflow">От идеи до выступления<ArrowRight aria-hidden className="size-5" /></a><div className={styles.deckVisual} aria-hidden><div><span>ПЛАН НА ЗАВТРА</span><strong>Большие идеи.<br />Понятные шаги.</strong><i>01 — 03</i></div><span>02</span><span>03</span></div></article>
          <article><span className={styles.formatIcon}><ImageIcon aria-hidden /></span><h3>Изображения с нужным настроением</h3><p>Опишите сюжет, создайте визуал и сохраните его в медиатеке. Используйте одну работу в письме и презентации.</p><a href="#workflow">От описания до визуала<ArrowRight aria-hidden className="size-5" /></a><div className={styles.imageVisual} aria-hidden><div /><div /><span>Свет. Форма. Характер.</span></div></article>
        </div>
      </section>
      <section className={styles.director}>
        <div className={styles.directorCopy}><span className={styles.darkIcon}><Sparkles aria-hidden /></span><h2>Взгляд со стороны.<br /><em>Прямо в проекте.</em></h2><p>Когда всё почти готово, откройте арт-директора. Он поможет заметить перегруженный слайд, слабый заголовок или неудачное кадрирование.</p><span className={styles.directorNote}>Вы решаете, какие замечания применить.</span></div>
        <div className={styles.reviewExample}><div><span>Пример разбора</span><Sparkles aria-hidden className="size-6" /></div><h3>Дайте главной мысли больше места</h3><p>На слайде сразу три акцента. Укоротите заголовок и оставьте один основной визуал — так идею будет легче считать.</p><div className={styles.reviewChips}><span>Композиция</span><span>Иерархия</span><span>Читаемость</span></div><div className={styles.reviewCompare} aria-hidden><div><i /><i /><i /><b /><b /><b /></div><ArrowRight className="size-6" /><div><strong>Одна<br />главная<br />мысль.</strong><span /></div></div></div>
      </section>
      <section id="workflow" className={styles.workflow}><div className={styles.sectionHead}><h2>От задумки<br /><span>к готовому проекту.</span></h2><p>Весь процесс перед глазами.<br />Следующий шаг всегда понятен.</p></div><div className={styles.steps}>{steps.map(([number,title,copy])=><article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
      <section id="questions" className={styles.faq}><h2>До начала работы</h2><div>{questions.map(([question,answer])=><details key={question}><summary>{question}<ChevronDown aria-hidden className="size-5" /></summary><p>{answer}</p></details>)}</div></section>
      <section className={styles.start}><Send aria-hidden /><h2>Дайте идее<br />свой <em>Поток.</em></h2><Link href="/register" className={styles.primary}>Создать аккаунт<ArrowRight aria-hidden className="size-6" /></Link><Link href="/login" className={styles.textLink}>Уже с нами? Войти</Link></section>
    </main>
    <footer className={styles.footer}><BrandMark href="/" /><span>© {new Date().getFullYear()} Поток</span><a href={`mailto:${brandConfig.supportEmail}`}>Связаться с нами ↗</a><Link href="/login">Войти</Link></footer>
  </div>;
}

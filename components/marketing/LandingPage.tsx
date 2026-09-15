import Link from "next/link";
import { ArrowRight, Mail, Presentation, Image as ImageIcon, ChevronDown } from "@/components/ui/icons";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingFooter } from "./MarketingFooter";
import styles from "./Marketing.module.css";

const formats = [
  { icon: Mail, title: "Письма и рассылки", text: "Соберите письмо в редакторе, выберите получателей и запланируйте отправку.", features: ["Макеты из готовых блоков", "Контакты и сегменты", "Календарь и история отправок"] },
  { icon: Presentation, title: "Презентации", text: "Создайте слайды с нуля или продолжите работу над готовой презентацией.", features: ["Импорт PowerPoint и PDF", "Редактирование на холсте", "Экспорт готовых материалов"] },
  { icon: ImageIcon, title: "Изображения", text: "Подготовьте визуалы для проекта и храните их в общей медиатеке.", features: ["Загрузка своих изображений", "Генерация по описанию", "Использование в письмах и слайдах"] },
];
const steps = [
  ["Подготовьте основу", "Выберите шаблон, загрузите свой файл или опишите задачу помощнику."],
  ["Доработайте детали", "Отредактируйте текст и оформление. При необходимости запросите разбор у арт-директора."],
  ["Отправьте или сохраните", "Запланируйте рассылку по выбранным контактам или экспортируйте презентацию."],
];
const questions = [
  ["Можно загрузить готовые материалы?", "Да. Импортируйте письмо, загрузите презентацию в PowerPoint или PDF, добавьте свои изображения в медиатеку. После импорта можно продолжить работу в редакторе."],
  ["Обязательно использовать ИИ?", "Нет. Можно работать со своими текстами, изображениями и готовыми шаблонами. Генерация и рекомендации арт-директора — дополнительные инструменты, которые вы используете по необходимости."],
  ["Как отправляются рассылки?", "Подготовьте письмо, выберите контакты или сегмент и укажите время отправки. Поток передаст рассылку подключённому провайдеру. Её состояние можно проверить в календаре и истории отправок."],
  ["Как устроен доступ команды?", "Каждый участник входит в свой аккаунт. Администратор управляет приглашениями и доступом к контактным базам."],
];

export function LandingPage() {
  return <div className={styles.site}>
    <a className={styles.skip} href="#main">К содержанию</a>
    <MarketingHeader />
    <main id="main">
      <section className={styles.hero} aria-labelledby="hero-title">
        <img className={styles.heroPhoto} src="/landing/team-meeting.webp" alt="" width="1920" height="1295" fetchPriority="high" />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Письма · Презентации · Рассылки</p>
          <h1 id="hero-title">Всё для общения<br />с вашей аудиторией.</h1>
          <p className={styles.lead}>Создавайте письма и презентации, работайте с контактами и планируйте рассылки. В одном рабочем пространстве — Потоке.</p>
          <div className={styles.heroActions}>
            <Link href="/register" className={styles.primary}>Начать работу<ArrowRight aria-hidden /></Link>
            <a href="#product" className={styles.secondary}>Возможности Потока</a>
          </div>
        </div>
      </section>

      <section id="product" className={styles.product} aria-labelledby="product-title">
        <div className={styles.sectionHead}>
          <p className={styles.eyebrow}>Инструменты для ежедневной работы</p>
          <h2 id="product-title">От первого черновика<br />до отправки.</h2>
          <p>Готовьте материалы в одном месте.<br />Переходите к следующей задаче, сохраняя контекст.</p>
        </div>
        <div className={styles.formats}>{formats.map(({ icon: Icon, title, text, features }) =>
          <article key={title}>
            <Icon className={styles.formatIcon} aria-hidden />
            <h3>{title}</h3><p>{text}</p>
            <ul>{features.map(feature => <li key={feature}>{feature}</li>)}</ul>
          </article>
        )}</div>
      </section>

      <section id="workflow" className={styles.workflow} aria-labelledby="workflow-title">
        <div className={styles.workflowIntro}>
          <p className={styles.eyebrow}>Как работает Поток</p>
          <h2 id="workflow-title">Вы знаете задачу.<br />Здесь есть инструменты.</h2>
          <p>Начните с того, что уже есть: идеи, текста или готового файла. Дальше — редактор, медиатека и отправка.</p>
          <Link href="/register" className={styles.textLink}>Перейти к работе<ArrowRight aria-hidden /></Link>
        </div>
        <ol className={styles.steps}>{steps.map(([title, text], i) => <li key={title}>
          <span className={styles.stepNumber} aria-hidden>0{i + 1}</span>
          <div><h3>{title}</h3><p>{text}</p></div>
        </li>)}</ol>
      </section>

      <section className={styles.team} aria-labelledby="team-title">
        <div><p className={styles.eyebrow}>Команда и данные</p><h2 id="team-title">Общая работа.<br />Понятный доступ.</h2></div>
        <div className={styles.teamCopy}>
          <p>Приглашайте коллег и назначайте доступ к контактным базам. Каждый участник работает под своим аккаунтом.</p>
          <p>Перед рассылкой проверяйте согласия получателей. Информация об обработке данных и настройки cookies всегда доступны внизу страницы.</p>
          <Link href="/privacy" className={styles.textLink}>О персональных данных<ArrowRight aria-hidden /></Link>
        </div>
      </section>

      <section id="questions" className={styles.faq} aria-labelledby="faq-title">
        <div><p className={styles.eyebrow}>Перед началом</p><h2 id="faq-title">Есть вопросы?</h2><p>Несколько подробностей<br />о работе в Потоке.</p></div>
        <div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown aria-hidden /></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className={styles.start}>
        <h2>Ваш следующий проект<br />начинается здесь.</h2>
        <Link href="/register" className={styles.primary}>Создать аккаунт<ArrowRight aria-hidden /></Link>
      </section>
    </main>
    <MarketingFooter />
  </div>;
}

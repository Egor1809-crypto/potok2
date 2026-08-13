import type { EmailBlock, EmailTemplate, TemplateCategory } from "@/types";

type Theme = {
  id: string;
  name: string;
  accent: string;
  workspace: string;
  body: string;
  text: string;
  soft: string;
  frame: NonNullable<EmailTemplate["frameStyle"]>;
};

type Scenario = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  subject: string;
  preview: string;
  blocks: (theme: Theme, prefix: string) => EmailBlock[];
};

const themes: Theme[] = [
  { id: "violet", name: "Фиолетовый", accent: "#6D35E8", workspace: "#F2ECFF", body: "#FFFFFF", text: "#24163E", soft: "#F6F2FF", frame: "capsule" },
  { id: "cobalt", name: "Кобальт", accent: "#275DF5", workspace: "#EAF0FF", body: "#FFFFFF", text: "#122354", soft: "#EEF3FF", frame: "top-accent" },
  { id: "emerald", name: "Изумруд", accent: "#07866F", workspace: "#E8F5F1", body: "#FFFFFF", text: "#153E36", soft: "#EDF8F5", frame: "soft" },
  { id: "coral", name: "Коралл", accent: "#E95E3F", workspace: "#FFF0EA", body: "#FFFEFC", text: "#51271D", soft: "#FFF5F1", frame: "right-band" },
  { id: "amber", name: "Янтарь", accent: "#C77A08", workspace: "#FFF5DF", body: "#FFFEFA", text: "#513710", soft: "#FFF8E9", frame: "editorial" },
  { id: "rose", name: "Роза", accent: "#C63E78", workspace: "#FDECF4", body: "#FFFFFF", text: "#522038", soft: "#FFF3F8", frame: "inset" },
  { id: "sky", name: "Небо", accent: "#2387C9", workspace: "#EAF6FC", body: "#FFFFFF", text: "#143A51", soft: "#F0F9FD", frame: "bottom-accent" },
  { id: "plum", name: "Слива", accent: "#763B84", workspace: "#F3EAF5", body: "#FFFFFF", text: "#3D2143", soft: "#F8F1FA", frame: "double" },
  { id: "ink", name: "Чернила", accent: "#334155", workspace: "#E9EDF2", body: "#FFFFFF", text: "#172033", soft: "#F3F5F7", frame: "hairline" },
  { id: "noir", name: "Графит", accent: "#51B9FF", workspace: "#11141A", body: "#20242B", text: "#F7F9FC", soft: "#2A3039", frame: "top-accent" },
  { id: "sand", name: "Песок", accent: "#8C6741", workspace: "#F3EDE3", body: "#FFFDF8", text: "#3F3328", soft: "#F8F2E9", frame: "stamp" },
  { id: "lime", name: "Лайм", accent: "#4A8E32", workspace: "#EEF7E9", body: "#FFFFFF", text: "#28401F", soft: "#F4FAF1", frame: "offset" },
];

const logo = (id: string, theme: Theme, label: string): EmailBlock => ({ id: `${id}-logo`, type: "logo", content: `TECH‑PRAVO / ${label}`, alignment: "left", textColor: theme.accent, letterSpacing: 2, paddingTop: 28, paddingBottom: 14 });
const footer = (id: string, theme: Theme): EmailBlock => ({ id: `${id}-footer`, type: "footer", content: "TECH‑PRAVO · Настроить подписку · Отписаться", alignment: "center", textColor: theme.id === "noir" ? "#AEB7C5" : theme.text, paddingTop: 22, paddingBottom: 28 });
const pattern = (id: string, theme: Theme, content = "◆  ·  ◇  ·  ◆  ·  ◇  ·  ◆\n·  ◇  ·  ◆  ·  ◇  ·  ◆  ·"): EmailBlock => ({ id: `${id}-pattern`, type: "pattern", content, alignment: "center", backgroundColor: "transparent", textColor: theme.accent, fontSize: 14, letterSpacing: 3, paddingTop: 10, paddingBottom: 10 });

const scenarios: Scenario[] = [
  {
    id: "service-status", name: "Сервисный статус", category: "Transactional",
    description: "Понятное системное сообщение с крупным статусом, деталями операции и следующим действием.",
    subject: "Готово: операция для {{company}} выполнена", preview: "Статус, детали и ссылка на личный кабинет.",
    blocks: (t, p) => [logo(p, t, "STATUS"), { id: `${p}-hero`, type: "hero", content: "Готово — всё сработало|Операция завершена, изменения уже доступны в аккаунте.", alignment: "left", backgroundColor: t.accent, textColor: "#FFFFFF", fontSize: 34, borderRadius: 28 }, { id: `${p}-notice`, type: "notice", content: "СТАТУС|Подтверждено · 13 августа · 12:40|Дополнительных действий не требуется.", alignment: "left", backgroundColor: t.soft, textColor: t.text, borderColor: t.accent, borderWidth: 1, borderRadius: 18 }, { id: `${p}-button`, type: "button", content: "Открыть кабинет", label: "Открыть кабинет", href: "https://tech-pravo.ru/", alignment: "left", textColor: "#FFFFFF", borderRadius: 12 }, pattern(p, t), footer(p, t)],
  },
  {
    id: "event-invite", name: "Приглашение на событие", category: "Events",
    description: "Выразительное приглашение с датой, программой, билетом и одним главным действием.",
    subject: "{{first_name}}, ваше приглашение на закрытую встречу", preview: "Дата, программа и персональный билет внутри.",
    blocks: (t, p) => [logo(p, t, "EVENTS"), pattern(p, t, "┏━━ ◇ ━━━━━━━ ◇ ━━┓\n┗━━ ◇ ━━━━━━━ ◇ ━━┛"), { id: `${p}-hero`, type: "hero", content: "Встреча, после которой есть что внедрить|26 сентября · Москва · 18:30", alignment: "center", backgroundColor: t.soft, textColor: t.text, fontSize: 40, borderRadius: 20 }, { id: `${p}-timeline`, type: "timeline", content: "18:30|Сбор гостей|19:00|Практический разбор|20:00|Дискуссия и нетворкинг", alignment: "left", textColor: t.text }, { id: `${p}-coupon`, type: "coupon", content: "ВАШ БИЛЕТ|LEGAL‑2609|Покажите код при регистрации", alignment: "center", backgroundColor: t.soft, textColor: t.text, borderRadius: 12 }, { id: `${p}-button`, type: "button", content: "Подтвердить участие", label: "Подтвердить участие", href: "https://tech-pravo.ru/", alignment: "center", textColor: "#FFFFFF", borderRadius: 12 }, footer(p, t)],
  },
  {
    id: "editorial-digest", name: "Редакционный дайджест", category: "Newsletter",
    description: "Спокойный содержательный выпуск с сильной типографикой, тезисами и редакционной цитатой.",
    subject: "Три изменения, которые стоит обсудить с командой", preview: "Практический обзор без информационного шума.",
    blocks: (t, p) => [logo(p, t, "DIGEST"), { id: `${p}-heading`, type: "heading", content: "Три наблюдения, которые меняют ежедневную практику", alignment: "left", textColor: t.text, fontFamily: "Georgia", fontWeight: 400, fontSize: 43, lineHeight: 115 }, { id: `${p}-text`, type: "text", content: "{{first_name}}, собрали факты, решения и вопросы, которые стоит обсудить внутри {{company}} на этой неделе.", alignment: "left", textColor: t.text, fontFamily: "Georgia", fontSize: 17, lineHeight: 175 }, { id: `${p}-check`, type: "checklist", content: "Новый подход к работе с данными|Практика безопасного применения ИИ|Изменения в коммуникации с клиентами", alignment: "left", textColor: t.text }, { id: `${p}-quote`, type: "quote", content: "Хороший обзор не добавляет информации — он помогает принять решение.|Редакция TECH‑PRAVO", alignment: "left", backgroundColor: t.soft, textColor: t.text, fontFamily: "Georgia", borderRadius: 8 }, { id: `${p}-button`, type: "button", content: "Читать выпуск", label: "Читать выпуск", href: "https://tech-pravo.ru/", alignment: "left", buttonStyle: "outline", textColor: t.accent, borderRadius: 4 }, pattern(p, t), footer(p, t)],
  },
  {
    id: "product-launch", name: "Запуск продукта", category: "Business",
    description: "Продуктовый анонс с контрастной обложкой, преимуществами, цифрами и карточкой предложения.",
    subject: "Представляем новый рабочий инструмент", preview: "Что изменилось и как попробовать первым.",
    blocks: (t, p) => [logo(p, t, "PRODUCT"), { id: `${p}-banner`, type: "banner", content: "НОВЫЙ ПРОДУКТ|Одна рабочая среда вместо цепочки разрозненных инструментов.", alignment: "left", backgroundColor: t.accent, textColor: "#FFFFFF", fontSize: 22, borderRadius: 22 }, { id: `${p}-stats`, type: "stats", content: "3×|быстрее подготовка|1 окно|для всей команды", alignment: "center", backgroundColor: t.soft, textColor: t.text, borderRadius: 16 }, { id: `${p}-product`, type: "product", content: "Рабочая студия|Шаблоны, совместная правка и готовый HTML без потери дизайна.|Доступ уже открыт", label: "Попробовать", href: "https://tech-pravo.ru/", alignment: "left", backgroundColor: t.soft, textColor: t.text, borderColor: t.accent, borderWidth: 1, borderRadius: 18 }, { id: `${p}-check`, type: "checklist", content: "Готовые визуальные системы|Сохранение своих шаблонов|Экспорт в HTML, PDF и Word", alignment: "left", textColor: t.text }, footer(p, t)],
  },
  {
    id: "feedback", name: "Опрос и обратная связь", category: "Follow-up",
    description: "Короткий запрос обратной связи с мягкой композицией, шкалой смысла и понятной кнопкой.",
    subject: "{{first_name}}, как всё прошло?", preview: "Ваш ответ займёт меньше двух минут.",
    blocks: (t, p) => [logo(p, t, "FEEDBACK"), { id: `${p}-hero`, type: "hero", content: "Как прошёл ваш опыт?|Один короткий ответ поможет сохранить сильные стороны и исправить слабые.", alignment: "center", backgroundColor: t.accent, textColor: "#FFFFFF", fontSize: 36, borderRadius: 28 }, { id: `${p}-text`, type: "text", content: "{{first_name}}, недавно вы работали с командой {{company}}. Расскажите, насколько процесс был понятным и полезным.", alignment: "center", textColor: t.text, fontSize: 16, paddingLeft: 52, paddingRight: 52 }, { id: `${p}-columns`, type: "columns", content: "Что понравилось\nОтметьте сильную часть процесса.|Что улучшить\nПодскажите, где было сложно.", alignment: "left", backgroundColor: t.soft, textColor: t.text, borderColor: t.accent, borderWidth: 1, borderRadius: 16 }, { id: `${p}-button`, type: "button", content: "Оставить отзыв", label: "Оставить отзыв", href: "https://tech-pravo.ru/", alignment: "center", textColor: "#FFFFFF", borderRadius: 14 }, pattern(p, t), footer(p, t)],
  },
  {
    id: "personal-outreach", name: "Личное обращение", category: "Outreach",
    description: "Сдержанное персональное письмо руководителю: повод, ценность и простой следующий шаг.",
    subject: "Идея для {{company}}", preview: "Короткий контекст и предложение обсудить задачу.",
    blocks: (t, p) => [logo(p, t, "PERSONAL NOTE"), { id: `${p}-heading`, type: "heading", content: "{{first_name}}, есть конкретная идея для вашей команды", alignment: "left", textColor: t.text, fontFamily: "Georgia", fontWeight: 400, fontSize: 38 }, { id: `${p}-text`, type: "text", content: "Я изучил открытые материалы {{company}} и увидел возможность упростить подготовку клиентских коммуникаций без потери фирменного стиля.", alignment: "left", textColor: t.text, fontSize: 16, lineHeight: 170 }, { id: `${p}-quote`, type: "quote", content: "Предлагаю не презентацию, а короткий разбор одного реального сценария вашей команды.|Егор", alignment: "left", backgroundColor: t.soft, textColor: t.text, borderRadius: 10 }, { id: `${p}-button`, type: "button", content: "Выбрать время", label: "Выбрать время", href: "https://tech-pravo.ru/", alignment: "left", buttonStyle: "soft", textColor: t.accent, borderRadius: 10 }, { id: `${p}-signature`, type: "signature", content: "Егор Сабалин|Основатель Поток|info@tech-pravo.ru", alignment: "left", textColor: t.text }, footer(p, t)],
  },
  {
    id: "security", name: "Безопасность аккаунта", category: "Transactional",
    description: "Строгое письмо безопасности с причиной, ограниченным по времени действием и понятной защитой.",
    subject: "Подтвердите действие в аккаунте", preview: "Безопасная ссылка действует 30 минут.",
    blocks: (t, p) => [logo(p, t, "SECURITY"), { id: `${p}-heading`, type: "heading", content: "Подтвердите действие, чтобы защитить аккаунт", alignment: "left", textColor: t.text, fontSize: 36 }, { id: `${p}-banner`, type: "banner", content: "БЕЗОПАСНАЯ ССЫЛКА|Действует 30 минут и открывается только один раз.", alignment: "left", backgroundColor: t.id === "noir" ? "#11151B" : t.soft, textColor: t.id === "noir" ? "#FFFFFF" : t.text, borderColor: t.accent, borderWidth: 1, borderRadius: 8 }, { id: `${p}-button`, type: "button", content: "Подтвердить действие", label: "Подтвердить действие", href: "https://tech-pravo.ru/", alignment: "center", textColor: "#FFFFFF", borderRadius: 6 }, { id: `${p}-notice`, type: "notice", content: "ЭТО НЕ ВЫ?|Не переходите по ссылке и смените пароль в настройках.|Поддержка поможет проверить активные сессии.", alignment: "left", backgroundColor: t.soft, textColor: t.text, borderColor: t.accent, borderWidth: 1, borderRadius: 8 }, footer(p, t)],
  },
  {
    id: "case-update", name: "Статус проекта", category: "Business",
    description: "Деловое обновление со статусом, хронологией, документом и ответственным специалистом.",
    subject: "Обновление по проекту {{company}}", preview: "Что сделано, что дальше и какой документ готов.",
    blocks: (t, p) => [logo(p, t, "PROJECT UPDATE"), { id: `${p}-banner`, type: "banner", content: "ЭТАП ЗАВЕРШЁН|Материалы проверены, следующая контрольная точка — 20 августа.", alignment: "left", backgroundColor: t.accent, textColor: "#FFFFFF", fontSize: 18, borderRadius: 14 }, { id: `${p}-timeline`, type: "timeline", content: "8 августа|Получили документы|11 августа|Завершили проверку|13 августа|Подготовили выводы", alignment: "left", textColor: t.text }, { id: `${p}-document`, type: "document", content: "Отчёт по проекту {{company}}|PDF · 12 страниц|Версия от 13.08.2026", label: "Открыть отчёт", href: "https://tech-pravo.ru/", alignment: "left", backgroundColor: t.soft, textColor: t.text, borderColor: t.accent, borderWidth: 1, borderRadius: 14 }, { id: `${p}-signature`, type: "signature", content: "Анна Морозова|Руководитель проекта|info@tech-pravo.ru", alignment: "left", backgroundColor: t.soft, textColor: t.text, borderRadius: 12 }, footer(p, t)],
  },
  {
    id: "webinar", name: "Вебинар и обучение", category: "Events",
    description: "Программа онлайн-встречи с сильной обложкой, фактами, таймлайном и записью в календарь.",
    subject: "Практический вебинар для команды {{company}}", preview: "40 минут, три кейса и готовый чек-лист.",
    blocks: (t, p) => [logo(p, t, "LIVE SESSION"), { id: `${p}-hero`, type: "hero", content: "Практический вебинар без воды|25 сентября · 19:00 · онлайн", alignment: "center", backgroundColor: t.accent, textColor: "#FFFFFF", fontSize: 41, borderRadius: 22 }, { id: `${p}-stats`, type: "stats", content: "40 мин|длительность|3 кейса|из реальной практики", alignment: "center", backgroundColor: t.soft, textColor: t.text, borderRadius: 16 }, { id: `${p}-check`, type: "checklist", content: "Как выбрать безопасный сценарий ИИ|Как проверить результат|Как закрепить процесс внутри команды", alignment: "left", textColor: t.text }, { id: `${p}-button`, type: "button", content: "Зарегистрироваться", label: "Зарегистрироваться", href: "https://tech-pravo.ru/", alignment: "center", textColor: "#FFFFFF", borderRadius: 12 }, pattern(p, t), footer(p, t)],
  },
];

export const generatedTemplates: EmailTemplate[] = themes.flatMap((theme, themeIndex) =>
  scenarios.map((scenario, scenarioIndex) => {
    const prefix = `scale-${scenario.id}-${theme.id}`;
    return {
      id: `template-v6-scale-${scenario.id}-${theme.id}`,
      name: `${scenario.name} · ${theme.name}`,
      category: scenario.category,
      description: `${scenario.description} Палитра «${theme.name}».`,
      subject: scenario.subject,
      previewText: scenario.preview,
      accentColor: theme.accent,
      backgroundColor: theme.workspace,
      bodyBackground: theme.body,
      contentWidth: scenario.id === "personal-outreach" || scenario.id === "editorial-digest" ? 580 : 620,
      frameStyle: theme.frame,
      frameColor: theme.accent,
      frameRadius: theme.frame === "capsule" ? 32 : theme.frame === "inset" ? 18 : 12,
      thumbnailVariant: scenario.id === "editorial-digest" || scenario.id === "personal-outreach" ? "editorial" : scenario.id === "event-invite" || scenario.id === "product-launch" ? "bold" : "classic",
      blocks: scenario.blocks(theme, prefix),
      isFavorite: false,
      updatedAt: new Date(Date.UTC(2026, 7, 13, 12, themeIndex, scenarioIndex)).toISOString(),
    };
  }),
);

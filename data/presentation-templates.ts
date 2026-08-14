import type {
  PresentationProjectRecord,
  PresentationSlide,
  PresentationThemeId,
} from "@/types/api";

export type PresentationTheme = {
  id: PresentationThemeId;
  name: string;
  description: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  surfaceColor: string;
};

export const presentationThemes: PresentationTheme[] = [
  {
    id: "atelier",
    name: "Ателье",
    description: "Тёплая бумага, редакционная типографика",
    accentColor: "#7C35F2",
    backgroundColor: "#FFF9F1",
    textColor: "#211827",
    surfaceColor: "#F1E4D8",
  },
  {
    id: "modern",
    name: "Современный",
    description: "Чистая модульная сетка, карточки и много воздуха",
    accentColor: "#6558E8",
    backgroundColor: "#F6F7FB",
    textColor: "#111827",
    surfaceColor: "#FFFFFF",
  },
  {
    id: "editorial",
    name: "Редакционный",
    description: "Крупная типографика, журнальная сетка и коралловый акцент",
    accentColor: "#E8543E",
    backgroundColor: "#F6EFE5",
    textColor: "#171310",
    surfaceColor: "#FFFFFF",
  },
  {
    id: "neon",
    name: "Неон",
    description: "Тёмный digital-фон, лаймовый свет и технологичные карточки",
    accentColor: "#B7FF4A",
    backgroundColor: "#0A0D12",
    textColor: "#F7F9FC",
    surfaceColor: "#161B23",
  },
  {
    id: "botanical",
    name: "Ботаника",
    description: "Натуральная зелень, мягкая бумага и органические формы",
    accentColor: "#467A5A",
    backgroundColor: "#F4F1E8",
    textColor: "#1B2A20",
    surfaceColor: "#E1E8DC",
  },
  {
    id: "glass",
    name: "Стекло",
    description: "Холодные градиенты, прозрачные панели и воздушная сетка",
    accentColor: "#4F7CFF",
    backgroundColor: "#EAF1FF",
    textColor: "#152342",
    surfaceColor: "#FFFFFF",
  },
  {
    id: "mono",
    name: "Моно",
    description: "Чёрно-белая система, строгая сетка и высокий контраст",
    accentColor: "#111111",
    backgroundColor: "#F8F8F6",
    textColor: "#111111",
    surfaceColor: "#FFFFFF",
  },
  {
    id: "clay",
    name: "Терракота",
    description: "Тёплая керамическая палитра и спокойные геометрические формы",
    accentColor: "#B85C45",
    backgroundColor: "#F7EBDD",
    textColor: "#3B241E",
    surfaceColor: "#EFD4C5",
  },
  {
    id: "cobalt",
    name: "Кобальт",
    description: "Яркий синий, лимонные акценты и динамичная геометрия",
    accentColor: "#1249D8",
    backgroundColor: "#EFF3FF",
    textColor: "#101C3A",
    surfaceColor: "#FFE96A",
  },
  {
    id: "berry",
    name: "Ягода",
    description: "Насыщенный пурпур, розовые поверхности и мягкие градиенты",
    accentColor: "#B22672",
    backgroundColor: "#FFF0F7",
    textColor: "#371528",
    surfaceColor: "#F5C9DE",
  },
  {
    id: "sky",
    name: "Небо",
    description: "Светлая голубая палитра и плавные воздушные линии",
    accentColor: "#2980C8",
    backgroundColor: "#EEF8FF",
    textColor: "#12324C",
    surfaceColor: "#D7EEFF",
  },
  {
    id: "sage",
    name: "Шалфей",
    description: "Приглушённая зелень для отчётов, исследований и экопроектов",
    accentColor: "#657A52",
    backgroundColor: "#F2F3EA",
    textColor: "#283020",
    surfaceColor: "#DDE2CF",
  },
  {
    id: "cinematic",
    name: "Кино",
    description:
      "Глубокий графит, красный акцент и кинематографичная композиция",
    accentColor: "#E4463A",
    backgroundColor: "#151515",
    textColor: "#F8F5EF",
    surfaceColor: "#292929",
  },
  {
    id: "playful",
    name: "Игра",
    description: "Лаванда, апельсин и дружелюбные модульные карточки",
    accentColor: "#FF6B35",
    backgroundColor: "#F5F0FF",
    textColor: "#2B2140",
    surfaceColor: "#DCCBFF",
  },
  {
    id: "violet",
    name: "Ультрафиолет",
    description: "Контрастный digital-стиль для сильного питча",
    accentColor: "#6D28D9",
    backgroundColor: "#F6F2FF",
    textColor: "#211334",
    surfaceColor: "#E6DBFF",
  },
  {
    id: "noir",
    name: "Нуар",
    description: "Тёмная премиальная подача без визуального шума",
    accentColor: "#B7FF5A",
    backgroundColor: "#101113",
    textColor: "#F5F1E8",
    surfaceColor: "#23262A",
  },
  {
    id: "ocean",
    name: "Глубина",
    description: "Спокойный синий для стратегии и исследований",
    accentColor: "#36C7B5",
    backgroundColor: "#ECF8F7",
    textColor: "#10303A",
    surfaceColor: "#D0EEEA",
  },
  {
    id: "sunrise",
    name: "Восход",
    description: "Тёплый энергичный акцент для запуска продукта",
    accentColor: "#F05A3C",
    backgroundColor: "#FFF4E7",
    textColor: "#351B1A",
    surfaceColor: "#FFDCC5",
  },
  {
    id: "premium",
    name: "Премиум",
    description: "Графит, слоновая кость и тонкие золотые акценты",
    accentColor: "#B8944F",
    backgroundColor: "#F7F2E8",
    textColor: "#1B1917",
    surfaceColor: "#E8DDC8",
  },
];

function slide(
  id: string,
  layout: PresentationSlide["layout"],
  title: string,
  body = "",
  bullets: string[] = [],
  eyebrow = "",
): PresentationSlide {
  return {
    id,
    layout,
    eyebrow,
    title,
    body,
    bullets,
    speakerNotes: "",
  };
}

export const defaultPresentationSlides: PresentationSlide[] = [
  slide(
    "slide-title",
    "title",
    "Название презентации",
    "Коротко объясните, о чём эта история и для кого она создана",
    [],
    "ПРЕЗЕНТАЦИИ «ПОТОК»",
  ),
  slide(
    "slide-point",
    "statement",
    "Одна сильная мысль, которую аудитория должна запомнить",
    "Подкрепите её контекстом или фактом — без длинного вступления.",
  ),
  slide(
    "slide-action",
    "closing",
    "Что должно произойти дальше",
    "Сформулируйте одно понятное действие или решение.",
  ),
];

export type PresentationStarterTemplate = Pick<
  PresentationProjectRecord,
  | "id"
  | "name"
  | "description"
  | "themeId"
  | "accentColor"
  | "backgroundColor"
  | "textColor"
  | "slides"
> & { useCase: string };

function starter(
  id: string,
  name: string,
  description: string,
  useCase: string,
  themeId: PresentationThemeId,
  slides: PresentationSlide[],
): PresentationStarterTemplate {
  const theme =
    presentationThemes.find((item) => item.id === themeId) ??
    presentationThemes[0];
  return {
    id,
    name,
    description,
    useCase,
    themeId,
    accentColor: theme.accentColor,
    backgroundColor: theme.backgroundColor,
    textColor: theme.textColor,
    slides,
  };
}

const corePresentationTemplates: PresentationStarterTemplate[] = [
  starter(
    "presentation-template-pitch",
    "Питч для клиента",
    "Логика от задачи клиента к решению и следующему шагу.",
    "Продажа услуги",
    "violet",
    [
      slide(
        "pitch-1",
        "title",
        "Решение для {{company}}",
        "Как получить результат без лишней операционной нагрузки",
        [],
        "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ",
      ),
      slide(
        "pitch-2",
        "statement",
        "Сейчас команда теряет фокус на работе, которую можно упростить",
        "Опишите наблюдаемую проблему языком клиента, а не продукта.",
      ),
      slide(
        "pitch-3",
        "split",
        "Что меняется с нашим подходом",
        "Слева — текущий процесс. Справа — более ясный рабочий сценарий.",
        [
          "Меньше ручных действий",
          "Единая точка контроля",
          "Понятная ответственность",
        ],
      ),
      slide(
        "pitch-4",
        "bullets",
        "Как устроено решение",
        "Три шага, которые можно проверить до запуска.",
        [
          "Диагностика исходной ситуации",
          "Настройка целевого процесса",
          "Запуск и измерение результата",
        ],
      ),
      slide(
        "pitch-5",
        "quote",
        "Доверие создаёт не обещание, а прозрачный способ проверить результат",
        "Добавьте реальный отзыв или наблюдение клиента. Не используйте вымышленную цитату.",
      ),
      slide(
        "pitch-6",
        "closing",
        "Согласуем короткий рабочий созвон?",
        "За 30 минут уточним задачу и определим, есть ли смысл двигаться дальше.",
      ),
    ],
  ),
  starter(
    "presentation-template-research",
    "Исследование рынка",
    "Спокойная аналитическая структура: вопрос, наблюдения, вывод.",
    "Аналитика и стратегия",
    "ocean",
    [
      slide(
        "research-1",
        "title",
        "Что меняется на рынке",
        "Ключевые сигналы, которые влияют на решение",
        [],
        "ИССЛЕДОВАНИЕ",
      ),
      slide(
        "research-2",
        "statement",
        "Главный сдвиг — не в технологии, а в ожиданиях клиента",
        "Сформулируйте проверяемый вывод исследования.",
      ),
      slide(
        "research-3",
        "stats",
        "Сигналы, на которые стоит смотреть",
        "Используйте только подтверждённые показатели и укажите источник в заметках.",
        [
          "— | динамика спроса",
          "— | стоимость выбора",
          "— | скорость изменения",
        ],
      ),
      slide(
        "research-4",
        "bullets",
        "Что подтверждает вывод",
        "Разделите факты и интерпретации.",
        [
          "Данные рынка",
          "Интервью с участниками",
          "Наблюдение за поведением",
          "Ограничения выборки",
        ],
      ),
      slide(
        "research-5",
        "split",
        "Два реалистичных сценария",
        "Сопоставьте условия, риски и последствия каждого пути.",
        ["Базовый сценарий", "Сценарий ускорения", "Триггеры пересмотра"],
      ),
      slide(
        "research-6",
        "closing",
        "Решение на ближайший цикл",
        "Зафиксируйте действие, владельца и момент следующей проверки.",
      ),
    ],
  ),
  starter(
    "presentation-template-product",
    "Запуск продукта",
    "Динамичный рассказ от пользовательской задачи к запуску.",
    "Продукт и маркетинг",
    "sunrise",
    [
      slide(
        "product-1",
        "title",
        "Новый продукт, который решает конкретную задачу",
        "Для кого он создан и почему запуск важен сейчас",
        [],
        "PRODUCT LAUNCH",
      ),
      slide(
        "product-2",
        "statement",
        "Пользователю нужен результат, а не ещё один инструмент",
        "Опишите момент, в котором возникает потребность.",
      ),
      slide(
        "product-3",
        "split",
        "От проблемы к новому сценарию",
        "Покажите, что именно становится быстрее, проще или надёжнее.",
        ["Было: фрагментированный процесс", "Стало: единый понятный путь"],
      ),
      slide(
        "product-4",
        "bullets",
        "Что входит в первую версию",
        "Оставьте только функции, которые поддерживают главное обещание.",
        ["Основной сценарий", "Контроль результата", "Поддержка перехода"],
      ),
      slide(
        "product-5",
        "stats",
        "Как будем понимать, что запуск удался",
        "Замените заготовки на реальные критерии успеха.",
        [
          "— | активация",
          "— | повторное использование",
          "— | ценность для клиента",
        ],
      ),
      slide(
        "product-6",
        "closing",
        "Следующий шаг — проверить ценность на реальном сценарии",
        "Укажите формат пилота и критерий решения о масштабировании.",
      ),
    ],
  ),
  starter(
    "presentation-template-legal",
    "Юридическая позиция",
    "Строгая структура для объяснения фактов, рисков и рекомендации.",
    "Право и комплаенс",
    "noir",
    [
      slide(
        "legal-1",
        "title",
        "Правовая позиция по вопросу",
        "Краткое заключение для принятия решения",
        [],
        "LEGAL BRIEF",
      ),
      slide(
        "legal-2",
        "statement",
        "Рекомендация должна быть понятна до чтения деталей",
        "Сформулируйте вывод без двусмысленности и абсолютных гарантий.",
      ),
      slide(
        "legal-3",
        "bullets",
        "Фактическая основа",
        "Отделите подтверждённые обстоятельства от предположений.",
        ["Установленные факты", "Документы и источники", "Неопределённости"],
      ),
      slide(
        "legal-4",
        "split",
        "Аргументы и встречные риски",
        "Покажите обе стороны позиции и условия, при которых вывод меняется.",
        ["Аргументы в поддержку", "Контраргументы", "Условия пересмотра"],
      ),
      slide(
        "legal-5",
        "bullets",
        "Варианты действий",
        "Сопоставьте правовой риск, срок и обратимость каждого варианта.",
        [
          "Консервативный путь",
          "Сбалансированный путь",
          "Допустимый эксперимент",
        ],
      ),
      slide(
        "legal-6",
        "closing",
        "Решение и контрольная точка",
        "Зафиксируйте выбранный вариант, владельца и дату повторной оценки.",
      ),
    ],
  ),
  starter(
    "presentation-template-speaker",
    "Выступление эксперта",
    "Редакционная композиция для доклада и публичной истории.",
    "Конференция",
    "atelier",
    [
      slide(
        "speaker-1",
        "title",
        "Тема, ради которой стоит слушать дальше",
        "Одно предложение о пользе для аудитории",
        [],
        "АВТОРСКИЙ ДОКЛАД",
      ),
      slide(
        "speaker-2",
        "quote",
        "Начните с наблюдения, которое аудитория узнает в своей работе",
        "История должна подводить к теме, а не заменять её.",
      ),
      slide(
        "speaker-3",
        "statement",
        "Главная идея доклада формулируется в одной фразе",
        "Всё остальное — доказательство, пример или следствие этой идеи.",
      ),
      slide(
        "speaker-4",
        "bullets",
        "Три опоры аргумента",
        "Каждая опора отвечает на отдельный вопрос аудитории.",
        [
          "Почему это важно",
          "Почему происходит именно так",
          "Что можно изменить",
        ],
      ),
      slide(
        "speaker-5",
        "split",
        "Как применить идею на практике",
        "Покажите контраст между привычным и более сильным подходом.",
        ["Привычный сценарий", "Новый принцип", "Первый небольшой шаг"],
      ),
      slide(
        "speaker-6",
        "closing",
        "Оставьте аудитории решение, а не резюме",
        "Закройте вопрос, с которого началась история.",
      ),
    ],
  ),
  starter(
    "presentation-template-report",
    "Итоги периода",
    "Чёткий отчёт о прогрессе, выводах и следующем приоритете.",
    "Внутренняя коммуникация",
    "ocean",
    [
      slide(
        "report-1",
        "title",
        "Итоги периода",
        "Что изменилось и на чём команда сфокусируется дальше",
        [],
        "РАБОЧИЙ ОТЧЁТ",
      ),
      slide(
        "report-2",
        "statement",
        "Главный результат периода",
        "Сформулируйте изменение, а не список выполненных задач.",
      ),
      slide(
        "report-3",
        "stats",
        "Результат в показателях",
        "Используйте сопоставимые данные и подпишите период в заметках.",
        ["— | результат", "— | качество", "— | темп"],
      ),
      slide(
        "report-4",
        "bullets",
        "Что сработало",
        "Свяжите действия с наблюдаемым эффектом.",
        ["Решение и его эффект", "Что стоит повторить", "Что перестать делать"],
      ),
      slide(
        "report-5",
        "split",
        "Риски и ответ команды",
        "Не прячьте неопределённость — покажите способ управления ею.",
        ["Текущий риск", "Сигнал раннего предупреждения", "Ответственный шаг"],
      ),
      slide(
        "report-6",
        "closing",
        "Приоритет следующего периода",
        "Одно главное направление, критерий результата и владелец.",
      ),
    ],
  ),
  starter(
    "presentation-template-investment",
    "Инвестиционный тизер",
    "Контрастная история: рынок, возможность, модель и запрос к инвестору.",
    "Инвестиции",
    "noir",
    [
      slide(
        "investment-1",
        "title",
        "Категория, которую можно пересобрать",
        "Короткое обещание проекта и стадия",
        [],
        "INVESTMENT TEASER",
      ),
      slide(
        "investment-2",
        "statement",
        "Сильная возможность начинается с наблюдаемого сдвига",
        "Опишите подтверждённое изменение рынка или поведения клиента.",
      ),
      slide(
        "investment-3",
        "split",
        "Проблема создаёт измеримую цену бездействия",
        "Отделите реальную боль от предположений.",
        ["Текущий сценарий", "Ограничение", "Возможность"],
      ),
      slide(
        "investment-4",
        "bullets",
        "Продукт превращает возможность в понятный путь",
        "Покажите механику, а не перечень функций.",
        [
          "Ключевой сценарий",
          "Почему решение трудно повторить",
          "Что уже проверено",
        ],
      ),
      slide(
        "investment-5",
        "stats",
        "Экономика должна читаться за десять секунд",
        "Добавьте только подтверждённые показатели.",
        ["— | выручка", "— | рост", "— | эффективность"],
      ),
      slide(
        "investment-6",
        "closing",
        "Запрос соответствует следующему доказуемому этапу",
        "Сумма, назначение и контрольная точка — без расплывчатых формулировок.",
      ),
    ],
  ),
  starter(
    "presentation-template-workshop",
    "Практический воркшоп",
    "Учебная структура с упражнением, разбором и переносом в работу.",
    "Обучение",
    "sunrise",
    [
      slide(
        "workshop-1",
        "title",
        "Навык, который участники применят сегодня",
        "Практический воркшоп без длинной теории",
        [],
        "WORKSHOP",
      ),
      slide(
        "workshop-2",
        "statement",
        "Сначала договоримся, что считается хорошим результатом",
        "Дайте участникам простой критерий самопроверки.",
      ),
      slide(
        "workshop-3",
        "bullets",
        "Три принципа, которые удерживают решение",
        "Каждый принцип должен вести к действию.",
        ["Принцип 1", "Принцип 2", "Принцип 3"],
      ),
      slide(
        "workshop-4",
        "split",
        "Упражнение: применяем подход на своём примере",
        "Слева — исходная ситуация. Справа — новая версия.",
        ["5 минут на работу", "2 минуты на проверку"],
      ),
      slide(
        "workshop-5",
        "quote",
        "Разбор полезен, когда объясняет выбор, а не оценивает человека",
        "Сформулируйте вопрос для совместной рефлексии.",
      ),
      slide(
        "workshop-6",
        "closing",
        "Один шаг, который участник сделает после встречи",
        "Зафиксируйте действие и срок.",
      ),
    ],
  ),
  starter(
    "presentation-template-case-study",
    "Кейс клиента",
    "Редакционный кейс от исходной ситуации до проверяемого результата.",
    "Продажи и кейсы",
    "atelier",
    [
      slide(
        "case-1",
        "title",
        "Как команда изменила рабочий сценарий",
        "Кейс без рекламных преувеличений",
        [],
        "CLIENT STORY",
      ),
      slide(
        "case-2",
        "statement",
        "До проекта ограничение было видно в конкретной работе",
        "Опишите исходную ситуацию языком клиента.",
      ),
      slide(
        "case-3",
        "split",
        "Решение началось не с инструмента, а с нового процесса",
        "Покажите ключевой выбор.",
        ["Было", "Изменили", "Стало"],
      ),
      slide(
        "case-4",
        "bullets",
        "Внедрение прошло через понятные контрольные точки",
        "Укажите только реальные этапы.",
        ["Диагностика", "Пилот", "Обучение", "Масштабирование"],
      ),
      slide(
        "case-5",
        "stats",
        "Результат подтверждают сопоставимые данные",
        "Добавьте период и источник в заметках.",
        ["— | результат", "— | качество", "— | срок"],
      ),
      slide(
        "case-6",
        "closing",
        "Следующий похожий сценарий можно проверить малым пилотом",
        "Предложите конкретный формат следующего шага.",
      ),
    ],
  ),
  starter(
    "presentation-template-board",
    "Решение для совета",
    "Сдержанная презентация для выбора между вариантами и фиксации решения.",
    "Руководство",
    "ocean",
    [
      slide(
        "board-1",
        "title",
        "Решение, которое требуется сегодня",
        "Контекст и границы вопроса",
        [],
        "DECISION MEMO",
      ),
      slide(
        "board-2",
        "statement",
        "Главный вывод должен быть понятен до деталей",
        "Одно предложение с рекомендуемым вариантом.",
      ),
      slide(
        "board-3",
        "split",
        "Варианты различаются риском, сроком и обратимостью",
        "Сопоставьте решения на общей основе.",
        ["Вариант A", "Вариант B", "Условие выбора"],
      ),
      slide(
        "board-4",
        "bullets",
        "Рекомендация опирается на четыре критерия",
        "Не смешивайте факты и оценочные суждения.",
        ["Ценность", "Риск", "Ресурсы", "Срок"],
      ),
      slide(
        "board-5",
        "statement",
        "Главный риск управляем при заранее заданном сигнале остановки",
        "Опишите контроль и владельца.",
      ),
      slide(
        "board-6",
        "closing",
        "Зафиксируем решение, владельца и дату проверки",
        "Последний слайд должен позволять принять решение в комнате.",
      ),
    ],
  ),
  starter(
    "presentation-template-brand-story",
    "Манифест бренда",
    "Смелая визуальная история для запуска идеи, сообщества или нового направления.",
    "Бренд и коммуникации",
    "violet",
    [
      slide(
        "brand-1",
        "title",
        "Идея, вокруг которой хочется объединиться",
        "Короткая формула бренда",
        [],
        "BRAND STORY",
      ),
      slide(
        "brand-2",
        "quote",
        "Мы начинаем не с продукта, а с убеждения",
        "Используйте реальную формулировку основателя или команды.",
      ),
      slide(
        "brand-3",
        "statement",
        "Старый способ больше не соответствует ожиданиям людей",
        "Покажите культурное или поведенческое напряжение.",
      ),
      slide(
        "brand-4",
        "split",
        "Новый язык бренда соединяет смысл и действие",
        "Контраст должен быть виден без длинного текста.",
        ["Что оставляем", "Что меняем", "Что обещаем"],
      ),
      slide(
        "brand-5",
        "bullets",
        "Система проявляется в каждом контакте",
        "Принципы для продукта, коммуникации и сервиса.",
        ["Принцип продукта", "Принцип голоса", "Принцип опыта"],
      ),
      slide(
        "brand-6",
        "closing",
        "Первое проявление новой идеи начинается сейчас",
        "Конкретный запуск или приглашение присоединиться.",
      ),
    ],
  ),
  starter(
    "presentation-template-roadmap",
    "Стратегическая дорожная карта",
    "Логика от выбора направления к этапам, рискам и контрольным точкам.",
    "Стратегия",
    "noir",
    [
      slide(
        "roadmap-1",
        "title",
        "Куда движется команда и почему сейчас",
        "Направление, горизонт и критерий успеха",
        [],
        "STRATEGY ROADMAP",
      ),
      slide(
        "roadmap-2",
        "statement",
        "Стратегия — это выбор того, что команда не будет делать",
        "Зафиксируйте фокус и границы.",
      ),
      slide(
        "roadmap-3",
        "split",
        "Текущая позиция определяет реалистичный темп",
        "Покажите возможности и ограничения.",
        ["Сильные стороны", "Ограничения", "Неопределённости"],
      ),
      slide(
        "roadmap-4",
        "bullets",
        "Три этапа ведут к проверяемому результату",
        "Каждый этап заканчивается решением.",
        ["Этап 1 · доказать", "Этап 2 · повторить", "Этап 3 · масштабировать"],
      ),
      slide(
        "roadmap-5",
        "stats",
        "Контрольные показатели привязаны к решениям",
        "Не добавляйте декоративные метрики.",
        ["— | сигнал", "— | порог", "— | дата проверки"],
      ),
      slide(
        "roadmap-6",
        "closing",
        "Следующий цикл начинается с одного приоритета",
        "Укажите владельца и первую контрольную точку.",
      ),
    ],
  ),
];

type StyleTemplateSpec = {
  slug: string;
  name: string;
  description: string;
  useCase: string;
  themeId: PresentationThemeId;
  eyebrow: string;
};

const styleTemplateSpecs: StyleTemplateSpec[] = [
  {
    slug: "product-glass",
    name: "Запуск продукта · Glass",
    description: "Воздушный продуктовый анонс с дорожной картой и сравнением.",
    useCase: "Продукт",
    themeId: "glass",
    eyebrow: "PRODUCT LAUNCH",
  },
  {
    slug: "cyber-neon",
    name: "Кибербезопасность · Neon",
    description:
      "Контрастный технологический доклад с процессом защиты и метриками.",
    useCase: "Технологии",
    themeId: "neon",
    eyebrow: "SECURITY BRIEF",
  },
  {
    slug: "brand-editorial",
    name: "Манифест бренда · Editorial",
    description:
      "Редакционная история о характере, голосе и визуальной системе бренда.",
    useCase: "Брендинг",
    themeId: "editorial",
    eyebrow: "BRAND STORY",
  },
  {
    slug: "eco-botanical",
    name: "Экологическая инициатива",
    description:
      "Органичная история проекта с целями, этапами и измеримым эффектом.",
    useCase: "ESG",
    themeId: "botanical",
    eyebrow: "IMPACT",
  },
  {
    slug: "legal-mono",
    name: "Правовая стратегия · Mono",
    description:
      "Строгая аргументация: позиция, риски, сравнение сценариев и решение.",
    useCase: "Право",
    themeId: "mono",
    eyebrow: "LEGAL STRATEGY",
  },
  {
    slug: "architecture-clay",
    name: "Архитектурная концепция",
    description:
      "Тёплая визуальная подача пространства, материалов и этапов проекта.",
    useCase: "Архитектура",
    themeId: "clay",
    eyebrow: "CONCEPT",
  },
  {
    slug: "investor-cobalt",
    name: "Инвесторский отчёт · Cobalt",
    description:
      "Энергичный квартальный обзор с диаграммами, таблицей и следующим шагом.",
    useCase: "Финансы",
    themeId: "cobalt",
    eyebrow: "INVESTOR UPDATE",
  },
  {
    slug: "culture-berry",
    name: "Культурная программа",
    description: "Выразительный анонс программы, спикеров и ключевых событий.",
    useCase: "События",
    themeId: "berry",
    eyebrow: "CULTURE PROGRAM",
  },
  {
    slug: "health-sky",
    name: "Медицинское исследование",
    description:
      "Спокойная доказательная структура для результатов исследования.",
    useCase: "Исследования",
    themeId: "sky",
    eyebrow: "RESEARCH",
  },
  {
    slug: "esg-sage",
    name: "Отчёт об устойчивости",
    description:
      "Сдержанный ESG-отчёт с показателями, инициативами и планом действий.",
    useCase: "Отчёты",
    themeId: "sage",
    eyebrow: "SUSTAINABILITY",
  },
  {
    slug: "documentary-cinematic",
    name: "Питч документального проекта",
    description:
      "Кинематографичная заявка: конфликт, герои, визуальный мир и производство.",
    useCase: "Медиа",
    themeId: "cinematic",
    eyebrow: "DOCUMENTARY PITCH",
  },
  {
    slug: "education-playful",
    name: "Интерактивный урок",
    description:
      "Дружелюбная учебная структура с вопросами, процессом и итоговой проверкой.",
    useCase: "Образование",
    themeId: "playful",
    eyebrow: "LEARNING LAB",
  },
  {
    slug: "luxury-premium",
    name: "Премиальное предложение",
    description: "Чёрно-золотая презентация предложения без визуального шума.",
    useCase: "Продажи",
    themeId: "premium",
    eyebrow: "PRIVATE OFFER",
  },
  {
    slug: "startup-violet",
    name: "Стартап-питч · Violet",
    description: "Проблема, решение, рынок, модель и запрос к инвестору.",
    useCase: "Стартап",
    themeId: "violet",
    eyebrow: "VENTURE PITCH",
  },
  {
    slug: "strategy-noir",
    name: "Стратегическая сессия · Noir",
    description:
      "Тёмная управленческая подача для решений, приоритетов и рисков.",
    useCase: "Стратегия",
    themeId: "noir",
    eyebrow: "EXECUTIVE SESSION",
  },
  {
    slug: "ocean-data",
    name: "Аналитика продукта",
    description: "Спокойная data-story с метриками, сравнением и выводами.",
    useCase: "Аналитика",
    themeId: "ocean",
    eyebrow: "PRODUCT DATA",
  },
  {
    slug: "sunrise-event",
    name: "Открытие мероприятия",
    description:
      "Энергичная программа события с таймлайном и призывом к участию.",
    useCase: "События",
    themeId: "sunrise",
    eyebrow: "EVENT OPENING",
  },
  {
    slug: "atelier-portfolio",
    name: "Портфолио студии",
    description: "Редакционная подборка проектов, подхода и результатов.",
    useCase: "Портфолио",
    themeId: "atelier",
    eyebrow: "SELECTED WORK",
  },
  {
    slug: "modern-roadmap",
    name: "Дорожная карта продукта",
    description:
      "Чистая модульная структура этапов, владельцев и критериев готовности.",
    useCase: "Продукт",
    themeId: "modern",
    eyebrow: "PRODUCT ROADMAP",
  },
  {
    slug: "glass-service",
    name: "Презентация сервиса",
    description:
      "Лёгкая SaaS-презентация с выгодами, процессом подключения и CTA.",
    useCase: "Продажи",
    themeId: "glass",
    eyebrow: "SERVICE OVERVIEW",
  },
  {
    slug: "mono-report",
    name: "Годовой отчёт · Mono",
    description:
      "Чёрно-белый управленческий отчёт с фактами и краткими выводами.",
    useCase: "Отчёты",
    themeId: "mono",
    eyebrow: "ANNUAL REPORT",
  },
  {
    slug: "berry-social",
    name: "Креативная кампания",
    description:
      "Смелая концепция кампании: аудитория, механика, контент и каналы.",
    useCase: "Маркетинг",
    themeId: "berry",
    eyebrow: "CAMPAIGN IDEA",
  },
  {
    slug: "cobalt-sales",
    name: "Коммерческое предложение",
    description:
      "Динамичная продажная история с ценностью, доказательствами и планом запуска.",
    useCase: "Продажи",
    themeId: "cobalt",
    eyebrow: "BUSINESS PROPOSAL",
  },
  {
    slug: "sage-policy",
    name: "Публичная политика",
    description:
      "Спокойная презентация инициативы, заинтересованных сторон и дорожной карты.",
    useCase: "Государство",
    themeId: "sage",
    eyebrow: "POLICY BRIEF",
  },
];

function styleTemplate(spec: StyleTemplateSpec): PresentationStarterTemplate {
  const prefix = `style-${spec.slug}`;
  return starter(
    `presentation-template-${spec.slug}`,
    spec.name,
    spec.description,
    spec.useCase,
    spec.themeId,
    [
      slide(
        `${prefix}-1`,
        "title",
        spec.name,
        spec.description,
        [],
        spec.eyebrow,
      ),
      slide(
        `${prefix}-2`,
        "agenda",
        "Как устроена история",
        "Короткая навигация по содержанию.",
        [
          "Контекст и задача",
          "Главная идея",
          "Доказательства",
          "План действий",
        ],
        "СТРУКТУРА",
      ),
      slide(
        `${prefix}-3`,
        "comparison",
        "Почему прежний подход больше не работает",
        "Сопоставьте текущую ситуацию и целевое состояние.",
        [
          "Разрозненный процесс",
          "Низкая прозрачность",
          "Единая система",
          "Проверяемый результат",
        ],
        "КОНТЕКСТ",
      ),
      slide(
        `${prefix}-4`,
        "process",
        "Путь к результату состоит из трёх шагов",
        "Каждый шаг заканчивается понятным решением.",
        ["Исследовать", "Собрать решение", "Проверить эффект"],
        "ПОДХОД",
      ),
      slide(
        `${prefix}-5`,
        "chart",
        "Динамика, которую важно показать",
        "Замените значения подтверждёнными данными.",
        ["24 | Сейчас", "48 | Этап 1", "67 | Этап 2", "86 | Цель"],
        "ДАННЫЕ",
      ),
      slide(
        `${prefix}-6`,
        "gallery",
        "Визуальное доказательство идеи",
        "Добавьте фотографию, продуктовый кадр или схему из медиатеки.",
        [],
        "ВИЗУАЛЬНЫЙ МИР",
      ),
      slide(
        `${prefix}-7`,
        "callout",
        "Следующий шаг должен быть простым",
        "Зафиксируйте одно действие, срок и ответственного.",
        [],
        "РЕШЕНИЕ",
      ),
      slide(
        `${prefix}-8`,
        "closing",
        "Готовы перейти к следующему шагу?",
        "Добавьте ссылку, контакт или конкретный запрос к аудитории.",
        [],
        "СПАСИБО",
      ),
    ],
  );
}

export const presentationTemplates: PresentationStarterTemplate[] = [
  ...corePresentationTemplates,
  ...styleTemplateSpecs.map(styleTemplate),
];

export function presentationTheme(themeId: PresentationThemeId) {
  return (
    presentationThemes.find((item) => item.id === themeId) ??
    presentationThemes[0]
  );
}

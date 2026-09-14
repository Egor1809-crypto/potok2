import { env } from "cloudflare:workers";
import { presentationLayoutContracts, presentationVisualIssues, requestedPresentationColors } from "@/lib/presentation-design-quality";

import { getD1 } from "@/db";
import {
  presentationPatternCatalog,
  presentationPatternIds,
  type PresentationPatternId,
} from "@/data/presentation-patterns";
import {
  presentationTemplates,
  presentationTheme,
} from "@/data/presentation-templates";
import {
  normalizePresentationBody,
  normalizePresentationBullet,
  normalizePresentationEyebrow,
  normalizePresentationTitle,
} from "@/lib/presentation-content-quality";
import type {
  PresentationAiRequest,
  PresentationAiResponse,
  PresentationSlide,
  PresentationSlideLayout,
  PresentationThemeId,
} from "@/types/api";

import {
  ApiRequestError,
  asObject,
  cleanText,
  newId,
  optionalInteger,
  optionalText,
} from "./api-utils";
import { ensureDatabase, WORKSPACE_ID } from "./database-init";
import {
  storeGeneratedEmailAsset,
  storeGeneratedEmailAssetBytes,
} from "./email-asset-store";
import { storePublicDomainFallbackImage } from "./public-domain-image-store";

const THEMES = new Set<PresentationThemeId>([
  "atelier",
  "modern",
  "editorial",
  "neon",
  "botanical",
  "glass",
  "mono",
  "clay",
  "cobalt",
  "berry",
  "sky",
  "sage",
  "cinematic",
  "playful",
  "violet",
  "noir",
  "ocean",
  "sunrise",
  "premium",
  "linen",
  "graphite",
  "nordic",
  "emerald",
  "signal",
  "museum",
  "paper",
  "plum",
]);
const LAYOUTS = new Set<PresentationSlideLayout>([
  "title",
  "statement",
  "split",
  "bullets",
  "quote",
  "stats",
  "timeline",
  "process",
  "comparison",
  "agenda",
  "gallery",
  "chart",
  "table",
  "callout",
  "closing",
]);
const GENERATION_WINDOW_MS = 10 * 60 * 1_000;
const GENERATION_LIMIT = 8;
const IDEMPOTENCY_STALE_MS = 15 * 60 * 1_000;
const PROVIDER_TIMEOUT_MS = 90_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;
const PRESENTATION_IMAGE_LIMIT = 2;
const PRESENTATION_IMAGE_TIMEOUT_MS = 90_000;
const PATTERNS = new Set<PresentationPatternId>(presentationPatternIds);

function runtime() {
  return env as unknown as {
    NAVYAI_API_KEY?: string;
    NAVYAI_BASE_URL?: string;
    NAVYAI_PRESENTATION_MODEL?: string;
    NAVYAI_EMAIL_MODEL?: string;
    NAVYAI_IMAGE_MODEL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_PRESENTATION_MODEL?: string;
    OPENAI_EMAIL_MODEL?: string;
  };
}

function provider() {
  const navyKey = runtime().NAVYAI_API_KEY?.trim();
  if (navyKey) {
    return {
      key: navyKey,
      provider: "navyai" as const,
      endpoint: `${runtime().NAVYAI_BASE_URL?.trim().replace(/\/$/, "") || "https://api.navy/v1"}/chat/completions`,
      model:
        runtime().NAVYAI_PRESENTATION_MODEL?.trim() ||
        runtime().NAVYAI_EMAIL_MODEL?.trim() ||
        "gpt-5.6-sol",
      fallbackModel: "gpt-5.6-terra",
      imageEndpoint: `${runtime().NAVYAI_BASE_URL?.trim().replace(/\/$/, "") || "https://api.navy/v1"}/images/generations`,
      imageModel: runtime().NAVYAI_IMAGE_MODEL?.trim() || "gpt-image-1.5",
    };
  }
  const openAiKey = runtime().OPENAI_API_KEY?.trim();
  return openAiKey
    ? {
        key: openAiKey,
        provider: "openai" as const,
        endpoint: "https://api.openai.com/v1/responses",
        model:
          runtime().OPENAI_PRESENTATION_MODEL?.trim() ||
          runtime().OPENAI_EMAIL_MODEL?.trim() ||
          "gpt-5.2",
        fallbackModel: undefined,
        imageEndpoint: "https://api.openai.com/v1/images/generations",
        imageModel: "gpt-image-1",
      }
    : null;
}

function parseRequest(
  value: unknown,
): Required<
  Pick<PresentationAiRequest, "goal" | "slideCount" | "themeId" | "tone">
> &
  Pick<
    PresentationAiRequest,
    | "audience"
    | "context"
    | "desiredAction"
    | "ctaLabel"
    | "ctaUrl"
    | "designBrief"
    | "socialLinks"
    | "creativeSource"
    | "templateId"
  > {
  const object = asObject(value);
  const goal = cleanText(object.goal, "Задача презентации", 4_000);
  if (goal.length < 12)
    throw new ApiRequestError(
      "Опишите задачу презентации хотя бы одним предложением.",
    );
  const rawTheme =
    optionalText(object.themeId, "Тема презентации", 30) ?? "atelier";
  if (!THEMES.has(rawTheme as PresentationThemeId))
    throw new ApiRequestError("Выберите допустимую тему презентации.");
  const ctaUrl = optionalText(object.ctaUrl, "Ссылка кнопки", 2_000);
  if (ctaUrl) {
    try {
      if (new URL(ctaUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new ApiRequestError("Ссылка кнопки должна начинаться с https://");
    }
  }
  const socialLinks = Array.isArray(object.socialLinks)
    ? object.socialLinks.slice(0, 8).flatMap((value, index) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return [];
        const row = value as Record<string, unknown>;
        const label = optionalText(
          row.label,
          `Название социальной сети ${index + 1}`,
          80,
        );
        const url = optionalText(
          row.url,
          `Ссылка социальной сети ${index + 1}`,
          2_000,
        );
        if (!label || !url) return [];
        try {
          if (new URL(url).protocol !== "https:") throw new Error();
        } catch {
          throw new ApiRequestError(
            `Ссылка «${label}» должна начинаться с https://`,
          );
        }
        return [{ label, url }];
      })
    : undefined;
  const creativeSource =
    object.creativeSource === "library" ? "library" : "original";
  const templateId =
    creativeSource === "library"
      ? optionalText(object.templateId, "Шаблон презентации", 160)
      : undefined;
  const template = templateId
    ? presentationTemplates.find((item) => item.id === templateId)
    : undefined;
  if (creativeSource === "library" && !template)
    throw new ApiRequestError(
      "Выбранный шаблон презентации не найден. Выберите другой.",
    );
  return {
    goal,
    audience: optionalText(object.audience, "Аудитория", 800),
    context: optionalText(object.context, "Исходные данные", 2_000),
    desiredAction: optionalText(object.desiredAction, "Желаемое действие", 500),
    ctaLabel: optionalText(object.ctaLabel, "Текст кнопки", 100),
    ctaUrl,
    designBrief: optionalText(object.designBrief, "Пожелания к дизайну", 1_500),
    socialLinks,
    creativeSource,
    templateId,
    tone:
      object.tone === "persuasive" ||
      object.tone === "educational" ||
      object.tone === "visual"
        ? object.tone
        : "executive",
    slideCount:
      template?.slides.length ??
      optionalInteger(object.slideCount, "Количество слайдов", 3, 20) ??
      7,
    themeId: template?.themeId ?? (rawTheme as PresentationThemeId),
  };
}

function resolvedThemeId(
  input: ReturnType<typeof parseRequest>,
): PresentationThemeId {
  if (input.creativeSource === "library" && input.templateId) {
    const template = presentationTemplates.find(
      (item) => item.id === input.templateId,
    );
    if (template) return template.themeId;
  }
  const brief = `${input.designBrief ?? ""} ${input.goal}`.toLocaleLowerCase(
    "ru-RU",
  );
  if (/(?:^|[^\p{L}])л[её]н(?:[^\p{L}]|$)|льнян|тканев|ремесл|крафт|натуральн.*материал/u.test(brief)) return "linen";
  if (/графит|board|совет директор|строг.*т[её]мн/.test(brief)) return "graphite";
  if (/сканди|север|nordic/.test(brief)) return "nordic";
  if (/изумруд|emerald/.test(brief)) return "emerald";
  if (/сигнальн|signal|ярк.*оранж/.test(brief)) return "signal";
  if (/музей|галере|выстав|куратор|lookbook/.test(brief)) return "museum";
  if (/бумажн|академ|научн.*защит|аналитическ.*записк/.test(brief)) return "paper";
  if (/сливов|пудров|plum|beauty|космет/.test(brief)) return "plum";
  if (/преми|luxur|дорог|элит|золот/.test(brief)) return "premium";
  if (/кино|cinema|dramatic|драмат|film/.test(brief)) return "cinematic";
  if (/неон|cyber|кибер|ярк.*т[её]мн/.test(brief)) return "neon";
  if (/редакц|editorial|журнал|fashion/.test(brief)) return "editorial";
  if (/эко|природ|ботан|органич|зел[её]н/.test(brief)) return "botanical";
  if (/стекл|glass|прозрач|градиент/.test(brief)) return "glass";
  if (/моно|black.?white|ч[её]рно.?бел/.test(brief)) return "mono";
  if (/терракот|керами|глин|землян/.test(brief)) return "clay";
  if (/кобальт|ультрамарин|синий.*ж[её]лт/.test(brief)) return "cobalt";
  if (/розов|ягод|малин|magenta/.test(brief)) return "berry";
  if (/неб|воздуш|голуб/.test(brief)) return "sky";
  if (/шалф|приглуш.*зел|sage/.test(brief)) return "sage";
  if (/игр|дружелюб|детск|playful/.test(brief)) return "playful";
  if (/т[её]мн|нуар|black|dark|контраст/.test(brief)) return "noir";
  if (/технолог|digital|неон|футур|фиолет|сирен/.test(brief)) return "violet";
  if (/спокой|исслед|аналит|син|бирюз|вод|океан/.test(brief)) return "ocean";
  if (/т[её]пл|энерг|запуск|оранж|корал|солн/.test(brief)) return "sunrise";
  if (/соврем|modern|минимал|saas|чист|аккурат|воздух/.test(brief))
    return "modern";
  return input.themeId;
}

function selectedPresentationTemplate(input: ReturnType<typeof parseRequest>) {
  if (input.creativeSource !== "library" || !input.templateId) return undefined;
  return presentationTemplates.find((item) => item.id === input.templateId);
}

function applyPresentationTemplateBlueprint(
  slides: PresentationSlide[],
  input: ReturnType<typeof parseRequest>,
) {
  const template = selectedPresentationTemplate(input);
  if (!template) return slides;
  return slides.map((slide, index) => {
    const reference =
      template.slides[index] ??
      template.slides[
        Math.min(
          Math.max(1, index % Math.max(2, template.slides.length - 1)),
          template.slides.length - 1,
        )
      ];
    if (!reference) return slide;
    return {
      ...slide,
      layout:
        index === 0
          ? "title"
          : index === slides.length - 1
            ? "closing"
            : reference.layout,
      themeId: reference.themeId ?? template.themeId,
      accentColor: reference.accentColor ?? template.accentColor,
      backgroundColor:
        reference.backgroundColor ?? template.backgroundColor,
      textColor: reference.textColor ?? template.textColor,
      patternId: reference.patternId ?? slide.patternId,
    };
  });
}

type PresentationNarrativeScenario =
  | "pitch"
  | "strategy"
  | "report"
  | "education"
  | "event"
  | "product"
  | "transformation"
  | "general";

type PresentationNarrativeBlueprint = {
  scenario: PresentationNarrativeScenario;
  audienceTension: string;
  centralThesis: string;
  narrativeArc: string[];
  evidencePolicy: string;
  compositionRhythm: string[];
  imageRoles: string[];
  closingLogic: string;
  avoid: string[];
};

function presentationNarrativeBlueprint(
  input: ReturnType<typeof parseRequest>,
): PresentationNarrativeBlueprint {
  const brief = `${input.goal}\n${input.context ?? ""}`.toLocaleLowerCase("ru-RU");
  const scenario: PresentationNarrativeScenario =
    /инвест|питч|продаж|коммерческ.*предлож|клиент/.test(brief)
      ? "pitch"
      : /стратег|дорожн.*карт|roadmap|приоритет|совет директор/.test(brief)
        ? "strategy"
        : /отч[её]т|аналит|исслед|результат|квартал|метрик/.test(brief)
          ? "report"
          : /обуч|урок|лекц|курс|воркшоп|семинар|защит.*работ/.test(brief)
            ? "education"
            : /мероприят|конференц|форум|программ.*событ|фестив/.test(brief)
              ? "event"
              : /продукт|запуск|релиз|saas|сервис|функц/.test(brief)
                ? "product"
                : /трансформ|изменен|внедрен|переход|реорганиз/.test(brief)
                  ? "transformation"
                  : "general";
  const blueprints: Record<
    PresentationNarrativeScenario,
    Omit<PresentationNarrativeBlueprint, "scenario" | "avoid">
  > = {
    pitch: {
      audienceTension: "Аудитория не уверена, что проблема достаточно важна, решение отличается от альтернатив, а риск следующего шага оправдан.",
      centralThesis: "Проведи аудиторию от узнаваемого напряжения к проверяемой ценности, доказательству и конкретному решению.",
      narrativeArc: ["Изменение контекста", "Цена проблемы", "Новый принцип решения", "Как работает", "Доказательство", "Риск и снятие риска", "Запрос"],
      evidencePolicy: "Рынок, клиенты, рост и ROI — только из подтверждённых данных. Без цифр используй механизм, критерии проверки и честные ограничения.",
      compositionRhythm: ["Крупный тезис", "Контраст до/после", "Схема механизма", "Доказательство", "План запуска", "Чёткий запрос"],
      imageRoles: ["Образ проблемы в реальном контексте", "Предметная метафора нового состояния"],
      closingLogic: "Финал формулирует решение, объём первого шага, владельца и критерий продолжения.",
    },
    strategy: {
      audienceTension: "Участники видят много инициатив, но не понимают, какую ставку выбрать и от чего отказаться.",
      centralThesis: "Свести контекст к нескольким стратегическим выборам и показать причинную связь между ставкой, действием и контрольным сигналом.",
      narrativeArc: ["Что изменилось", "Главное противоречие", "Выбор", "Система ставок", "Последовательность", "Риски", "Управленческое решение"],
      evidencePolicy: "Отделяй известные факты от гипотез; для гипотез задавай сигнал проверки, а не выдуманный прогноз.",
      compositionRhythm: ["Контекст", "Один выбор", "Матрица приоритетов", "Дорожная карта", "Риск", "Решение"],
      imageRoles: ["Метафора развилки или направления", "Системный образ взаимосвязанных элементов"],
      closingLogic: "Закрой презентацию одним приоритетом, первым действием и датой следующей проверки только если дата предоставлена.",
    },
    report: {
      audienceTension: "Аудитория видит данные, но не понимает, какой вывод важен и какое решение из него следует.",
      centralThesis: "Каждый факт должен обслуживать вывод; отделяй сигнал, объяснение, последствие и действие.",
      narrativeArc: ["Главный вывод", "Что изменилось", "Почему", "Где отклонение", "Что это означает", "Риск", "Решение"],
      evidencePolicy: "Никаких сгенерированных значений. Chart, stats и table разрешены только при наличии чисел в контексте.",
      compositionRhythm: ["Executive summary", "Данные", "Интерпретация", "Сравнение", "Рекомендация", "Следующий цикл"],
      imageRoles: ["Редакционный образ главного изменения", "Визуальная метафора причины или масштаба"],
      closingLogic: "Финал отвечает, что продолжать, что изменить и какой сигнал проверять дальше.",
    },
    education: {
      audienceTension: "Слушатель пока не видит цельную модель и не уверен, как применить знание после выступления.",
      centralThesis: "Построй понимание через вопрос, модель, пример, практическую проверку и перенос в реальную задачу.",
      narrativeArc: ["Проблемный вопрос", "Интуитивная модель", "Механизм", "Пример", "Практика", "Ошибки", "Перенос"],
      evidencePolicy: "Не подменяй обучение неподтверждённой статистикой; объясняй причинность и границы применимости.",
      compositionRhythm: ["Вопрос", "Схема", "Пример", "Пошаговый процесс", "Контраст ошибки", "Шпаргалка"],
      imageRoles: ["Наглядная предметная аналогия", "Сцена применения знания"],
      closingLogic: "Последний слайд даёт одну задачу для применения и критерий самопроверки.",
    },
    event: {
      audienceTension: "Аудитория не понимает уникальную ценность события и как провести время с пользой.",
      centralThesis: "Продай не расписание, а переход участника: с каким вопросом он приходит и с каким результатом уходит.",
      narrativeArc: ["Главная тема", "Почему сейчас", "Обещание опыта", "Маршрут программы", "Ключевые моменты", "Для кого", "Участие"],
      evidencePolicy: "Имена, время, место и программа — только из контекста; отсутствие данных не маскируй заглушками.",
      compositionRhythm: ["Атмосферный вход", "Тезис", "Маршрут", "Герои или темы", "Практическая ценность", "CTA"],
      imageRoles: ["Атмосфера пространства и масштаба", "Содержательный момент взаимодействия людей"],
      closingLogic: "Финал фиксирует для кого событие и одно действие для участия.",
    },
    product: {
      audienceTension: "Аудитория видит функции, но не понимает, как продукт меняет её рабочий сценарий.",
      centralThesis: "Покажи переход от прежнего ограничения к новому способу работы и первому проверяемому результату.",
      narrativeArc: ["Рабочее напряжение", "Новый принцип", "Сценарий использования", "Ключевые возможности", "Доказательство", "Внедрение", "Попробовать"],
      evidencePolicy: "Не выдумывай функции и метрики. Если данных мало, показывай механизм и план проверки.",
      compositionRhythm: ["Проблема", "Большой product statement", "Процесс", "Сравнение", "Use cases", "Старт"],
      imageRoles: ["Продукт в реальном контексте", "Концептуальная визуализация ключевого механизма"],
      closingLogic: "Предложи один ограниченный сценарий первого использования и критерий пользы.",
    },
    transformation: {
      audienceTension: "Люди понимают необходимость изменений, но опасаются масштаба, потери контроля и скрытых издержек.",
      centralThesis: "Разложи изменение на понятные фазы, решения, владельцев, риски и контрольные сигналы.",
      narrativeArc: ["Почему прежняя модель исчерпана", "Целевое состояние", "Принципы перехода", "Фазы", "Роли", "Риски", "Первый шаг"],
      evidencePolicy: "Не обещай трансформационный эффект без оснований; показывай зависимости и критерии готовности.",
      compositionRhythm: ["Контраст состояний", "Принципы", "Roadmap", "Матрица ролей", "Риски", "Решение"],
      imageRoles: ["Образ перехода между состояниями", "Системная метафора координации"],
      closingLogic: "Финал фиксирует минимально безопасный шаг и условие перехода к следующей фазе.",
    },
    general: {
      audienceTension: "Аудитория пока не видит, почему тема важна, как она устроена и какое решение требуется.",
      centralThesis: "Сформулируй один центральный вывод и проведи к нему через контекст, механизм, применение, ограничения и действие.",
      narrativeArc: ["Сильный вход", "Почему важно", "Как устроено", "Где применять", "Ограничения", "Критерии решения", "Следующий шаг"],
      evidencePolicy: "Используй только факты пользователя; неизвестное превращай в вопрос или критерий проверки, а не в выдумку.",
      compositionRhythm: ["Тезис", "Структура", "Практика", "Контраст", "Риск", "Вывод"],
      imageRoles: ["Редакционный образ центральной идеи", "Предметная метафора практического применения"],
      closingLogic: "Финал повторяет не тему, а решение и ближайшее действие аудитории.",
    },
  };
  return {
    scenario,
    ...blueprints[scenario],
    avoid: [
      "Заголовки-рубрики вроде «Возможности», «Риски», «Итоги» и «Наше решение»",
      "Повтор пользовательской команды или одинакового тезиса на нескольких слайдах",
      "Более двух одинаковых композиций или узоров подряд",
      "Неподтверждённые цифры, клиенты, цитаты и обещания результата",
      "Мелкий текст, параграфы вместо слайдов и декоративные изображения без смысловой роли",
    ],
  };
}

function outputText(value: unknown): string {
  const object = asObject(value);
  if (typeof object.output_text === "string" && object.output_text.trim())
    return object.output_text;
  if (Array.isArray(object.choices)) {
    for (const candidate of object.choices) {
      if (!candidate || typeof candidate !== "object") continue;
      const message = (candidate as { message?: unknown }).message;
      if (
        message &&
        typeof message === "object" &&
        typeof (message as { content?: unknown }).content === "string"
      ) {
        return (message as { content: string }).content;
      }
    }
  }
  if (Array.isArray(object.output)) {
    for (const candidate of object.output) {
      if (!candidate || typeof candidate !== "object") continue;
      const content = (candidate as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const item of content) {
        if (
          item &&
          typeof item === "object" &&
          typeof (item as { text?: unknown }).text === "string"
        )
          return (item as { text: string }).text;
      }
    }
  }
  throw new ApiRequestError(
    "ИИ не вернул структуру презентации. Повторите запрос.",
    502,
  );
}

function parseJson(value: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  try {
    return asObject(
      JSON.parse(
        start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned,
      ),
    );
  } catch {
    throw new ApiRequestError(
      "ИИ вернул текст вместо структуры презентации. Повторите запрос.",
      502,
    );
  }
}

function optionalModelText(value: unknown, field: string, max: number) {
  return typeof value === "string"
    ? optionalText(value, field, max)
    : undefined;
}

function parseSlides(
  value: unknown,
  expectedCount: number,
): PresentationSlide[] {
  if (!Array.isArray(value))
    throw new ApiRequestError("ИИ не вернул слайды презентации.", 502);
  const slides = value.slice(0, 20).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return [];
    const object = candidate as Record<string, unknown>;
    const rawTitle = optionalModelText(
      object.title,
      `Заголовок слайда ${index + 1}`,
      300,
    );
    if (!rawTitle) return [];
    const title = normalizePresentationTitle(rawTitle);
    const suggestedLayouts: PresentationSlideLayout[] = [
      "statement",
      "split",
      "bullets",
      "timeline",
      "comparison",
      "process",
      "stats",
      "gallery",
      "callout",
      "chart",
    ];
    const rawLayout =
      optionalModelText(object.layout, `Макет слайда ${index + 1}`, 30) ??
      (index === 0
        ? "title"
        : index === expectedCount - 1
          ? "closing"
          : suggestedLayouts[(index - 1) % suggestedLayouts.length]);
    const layout = LAYOUTS.has(rawLayout as PresentationSlideLayout)
      ? (rawLayout as PresentationSlideLayout)
      : "statement";
    const rawPattern = optionalModelText(
      object.patternId,
      `Узор слайда ${index + 1}`,
      40,
    );
    const patternId = PATTERNS.has(rawPattern as PresentationPatternId)
      ? (rawPattern as PresentationPatternId)
      : undefined;
    const rawTheme = optionalModelText(
      object.themeId,
      `Стиль слайда ${index + 1}`,
      30,
    );
    const themeId = THEMES.has(rawTheme as PresentationThemeId)
      ? (rawTheme as PresentationThemeId)
      : undefined;
    const bullets = Array.isArray(object.bullets)
      ? object.bullets
          .slice(0, 8)
          .flatMap((item) =>
            typeof item === "string" && item.trim()
              ? [normalizePresentationBullet(item)]
              : [],
          )
      : [];
    return [
      {
        id: newId("slide"),
        layout,
        eyebrow: normalizePresentationEyebrow(
          optionalModelText(
            object.eyebrow,
            `Надзаголовок слайда ${index + 1}`,
            120,
          ) ??
            (index === 0
              ? "ПРЕЗЕНТАЦИЯ"
              : index === expectedCount - 1
                ? "ВЫВОД"
                : `РАЗДЕЛ ${String(index).padStart(2, "0")}`),
        ),
        title,
        body: normalizePresentationBody(
          optionalModelText(object.body, `Текст слайда ${index + 1}`, 1_500) ??
            "",
        ),
        bullets,
        ...(patternId ? { patternId } : {}),
        ...(themeId ? { themeId } : {}),
        ...(optionalModelText(
          object.imagePrompt,
          `Описание изображения слайда ${index + 1}`,
          1_200,
        )
          ? {
              imagePrompt: optionalModelText(
                object.imagePrompt,
                `Описание изображения слайда ${index + 1}`,
                1_200,
              ),
            }
          : {}),
        speakerNotes:
          optionalModelText(
            object.speakerNotes,
            `Заметки слайда ${index + 1}`,
            3_000,
          ) ?? "",
      } satisfies PresentationSlide,
    ];
  });
  if (slides.length !== expectedCount)
    throw new ApiRequestError(`Нужно ровно ${expectedCount} слайдов; ИИ вернул ${slides.length}.`, 502);
  if (slides[0].layout !== "title" || slides.at(-1)?.layout !== "closing")
    throw new ApiRequestError("Первый слайд должен открывать презентацию, последний — завершать.", 502);
  return slides;
}

function presentationQualityIssues(
  slides: PresentationSlide[],
  input: ReturnType<typeof parseRequest>,
) {
  const issues: string[] = presentationVisualIssues(slides);
  const genericTitle = /^(?:введение|возможности|риски|итоги|выводы|наше решение|решение|проблема|преимущества|следующие шаги|заключение)[.!:—\s]*$/iu;
  const copiedCommand = /^(?:нужно|надо|сделай|создай|подготовь|разработай|сформируй|презентация (?:о|об|про|для))\b/iu;
  const titleKeys = slides.map((slide) =>
    slide.title
      .toLocaleLowerCase("ru-RU")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim(),
  );
  const repeatedTitles = titleKeys.filter(
    (title, index) => title.length > 8 && titleKeys.indexOf(title) !== index,
  );
  const genericTitles = slides.filter((slide) => genericTitle.test(slide.title));
  const copiedTitles = slides.filter((slide) => copiedCommand.test(slide.title));
  const truncatedTitles = slides.filter((slide) => slide.title.endsWith("…"));
  if (slides.length !== input.slideCount)
    issues.push(`Нужно ровно ${input.slideCount} слайдов, сейчас ${slides.length}.`);
  if (genericTitles.length)
    issues.push(`Заменить рубрикаторские заголовки на выводы: ${genericTitles.map((slide) => `«${slide.title}»`).join(", ")}.`);
  if (repeatedTitles.length)
    issues.push(`Убрать повторяющиеся заголовки: ${[...new Set(repeatedTitles)].map((title) => `«${title}»`).join(", ")}.`);
  if (copiedTitles.length)
    issues.push(`Переформулировать пользовательскую команду как тезис: ${copiedTitles.map((slide) => `«${slide.title}»`).join(", ")}.`);
  if (truncatedTitles.length)
    issues.push(`Сократить заголовки по смыслу, а не обрывать многоточием: ${truncatedTitles.map((slide) => `«${slide.title}»`).join(", ")}.`);
  const distinctLayouts = new Set(slides.map((slide) => slide.layout)).size;
  const expectedLayoutDiversity = Math.min(5, Math.max(3, Math.ceil(slides.length / 3)));
  if (distinctLayouts < expectedLayoutDiversity)
    issues.push(`Композиция монотонна: нужно минимум ${expectedLayoutDiversity} разных layout, сейчас ${distinctLayouts}.`);
  for (let index = 2; index < slides.length; index += 1) {
    if (
      slides[index].layout === slides[index - 1].layout &&
      slides[index].layout === slides[index - 2].layout
    ) {
      issues.push(`Layout «${slides[index].layout}» повторяется три раза подряд у слайда ${index + 1}.`);
      break;
    }
  }
  const missingNotes = slides.filter((slide) => !slide.speakerNotes.trim()).length;
  if (missingNotes > Math.floor(slides.length / 2))
    issues.push(`У ${missingNotes} слайдов нет полезных заметок выступающего.`);
  return issues.slice(0, 8);
}

function applyPresentationArtDirection(
  slides: PresentationSlide[],
  input: ReturnType<typeof parseRequest>,
  themeId: PresentationThemeId,
) {
  const noImages = /без\s+(?:фото|изображ|картин)|только\s+типограф/i.test(
    `${input.goal}\n${input.designBrief ?? ""}`,
  );
  const noPatterns = /без\s+(?:узор|орнамент|паттерн)|никаких.*(?:узор|орнамент)|без.*и\s+узор/iu.test(`${input.goal}\n${input.designBrief ?? ""}`);
  // Keep imagery on the slides the designer chose. Never displace a chart or cover a list.
  const imageIndexes = new Set(noImages ? [] : slides.flatMap((slide, index) =>
    slide.imagePrompt && presentationLayoutContracts[slide.layout].image ? [index] : [],
  ).slice(0, PRESENTATION_IMAGE_LIMIT));
  const directed = slides.map((slide, index): PresentationSlide => ({
    ...slide,
    themeId: themeId,
    ...requestedPresentationColors(input.designBrief),
    patternId: noPatterns ? "none" : slide.patternId ?? "none",
    imagePrompt: imageIndexes.has(index) ? slide.imagePrompt : undefined,
    // Without an image, the gallery has an empty half. Keep its text visible.
    layout: slide.layout === "gallery" && !imageIndexes.has(index) && !slide.imageUrl ? "statement" : slide.layout,
  }));
  return directed;
}

async function generatePresentationImages(
  request: Request,
  selected: NonNullable<ReturnType<typeof provider>>,
  slides: PresentationSlide[],
) {
  const targets = slides
    .filter((slide) => slide.imagePrompt && !slide.assetId)
    .slice(0, PRESENTATION_IMAGE_LIMIT);
  await Promise.all(
    targets.map(async (slide, index) => {
      try {
        const response = await fetch(selected.imageEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${selected.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: selected.imageModel,
            prompt: `${slide.imagePrompt}\nЗаконченное оригинальное изображение для профессиональной презентации. Не добавляй читаемый текст, логотип, интерфейс или водяной знак.`,
            size: "1536x1024",
            quality: "high",
            n: 1,
          }),
          signal: AbortSignal.timeout(PRESENTATION_IMAGE_TIMEOUT_MS),
        });
        const body = asObject(await response.json());
        const data = Array.isArray(body.data) ? body.data : [];
        const first =
          data[0] && typeof data[0] === "object"
            ? (data[0] as Record<string, unknown>)
            : null;
        if (!response.ok || !first) throw new Error("Image generation failed");
        const filename = `Иллюстрация презентации ${index + 1}`;
        const stored =
          typeof first.url === "string" && first.url.startsWith("https://")
            ? await storeGeneratedEmailAsset(
                request,
                first.url,
                "photo",
                filename,
              )
            : typeof first.b64_json === "string" && first.b64_json.length > 100
              ? await storeGeneratedEmailAssetBytes(
                  request,
                  Uint8Array.from(atob(first.b64_json), (character) =>
                    character.charCodeAt(0),
                  ),
                  "image/png",
                  "photo",
                  filename,
                )
              : null;
        if (!stored) throw new Error("Image provider returned no file");
        slide.assetId = stored.id;
        slide.imageUrl = stored.url;
      } catch (error) {
        console.warn(
          "Presentation AI visual generation failed",
          error instanceof Error ? error.message : "unknown error",
        );
        try {
          const fallback = await storePublicDomainFallbackImage(
            request,
            slide.imagePrompt || slide.title,
            `Тематическая иллюстрация презентации ${index + 1}`,
          );
          if (fallback) {
            slide.assetId = fallback.id;
            slide.imageUrl = fallback.url;
          }
        } catch (fallbackError) {
          console.warn(
            "Presentation public-domain visual fallback failed",
            fallbackError instanceof Error ? fallbackError.message : "unknown error",
          );
        }
      }
    }),
  );
  return slides;
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function safetyIdentifier(request: Request) {
  const source =
    request.headers.get("oai-authenticated-user-id") ??
    "mailflow-local-participant";
  return (await digest(source)).slice(0, 32);
}

function idempotencyHeader(request: Request) {
  const value =
    request.headers.get("idempotency-key")?.trim() || crypto.randomUUID();
  if (!/^[\w.:-]{8,160}$/.test(value)) {
    throw new ApiRequestError(
      "Заголовок Idempotency-Key содержит недопустимое значение.",
    );
  }
  return value;
}

type IdempotencyRow = {
  request_hash: string;
  status: "pending" | "completed" | "failed";
  result_json: string | null;
  updated_at: string;
};

async function existingPresentationRequest(key: string, requestHash: string) {
  const row = await getD1()
    .prepare(
      "SELECT request_hash, status, result_json, updated_at FROM ai_idempotency WHERE key = ?",
    )
    .bind(key)
    .first<IdempotencyRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash) {
    throw new ApiRequestError(
      "Этот Idempotency-Key уже использован для другого запроса.",
      409,
    );
  }
  const stale =
    row.status === "pending" &&
    Date.parse(row.updated_at) < Date.now() - IDEMPOTENCY_STALE_MS;
  if (stale) {
    await getD1()
      .prepare(
        "DELETE FROM ai_idempotency WHERE key = ? AND status = 'pending' AND updated_at = ?",
      )
      .bind(key, row.updated_at)
      .run();
    return null;
  }
  if (row.status === "pending") {
    throw new ApiRequestError(
      "Этот запрос уже выполняется. Дождитесь результата перед повтором.",
      409,
    );
  }
  if (row.status === "completed" && row.result_json) {
    try {
      return JSON.parse(row.result_json) as PresentationAiResponse;
    } catch {
      throw new ApiRequestError(
        "Сохранённый результат ИИ повреждён. Повторите с новым Idempotency-Key.",
        409,
      );
    }
  }
  if (row.status === "completed") {
    throw new ApiRequestError(
      "Этот запрос уже выполнен. Повторите с новым Idempotency-Key.",
      409,
    );
  }
  throw new ApiRequestError(
    "Предыдущая попытка с этим ключом завершилась ошибкой. Повторите с новым Idempotency-Key.",
    409,
  );
}

async function reservePresentationGeneration(
  request: Request,
  input: ReturnType<typeof parseRequest>,
) {
  const rawKey = idempotencyHeader(request);
  const actor =
    request.headers.get("oai-authenticated-user-id")?.trim() ||
    "mailflow-local-participant";
  const [actorHash, requestHash] = await Promise.all([
    digest(actor),
    digest(JSON.stringify(input)),
  ]);
  const key = await digest(
    `${WORKSPACE_ID}:presentation-outline:${actorHash}:${rawKey}`,
  );
  const replayed = await existingPresentationRequest(key, requestHash);
  if (replayed) return { key, replayed };

  const now = new Date();
  const nowIso = now.toISOString();
  const inserted = await getD1()
    .prepare(
      `
    INSERT OR IGNORE INTO ai_idempotency
      (key, workspace_id, operation, request_hash, status, asset_id, created_at, updated_at)
    VALUES (?, ?, 'presentation-outline', ?, 'pending', NULL, ?, ?)
  `,
    )
    .bind(key, WORKSPACE_ID, requestHash, nowIso, nowIso)
    .run();
  if ((inserted.meta.changes ?? 0) === 0) {
    const concurrent = await existingPresentationRequest(key, requestHash);
    if (concurrent) return { key, replayed: concurrent };
    throw new ApiRequestError(
      "Этот запрос уже выполняется. Дождитесь результата перед повтором.",
      409,
    );
  }

  const cutoffIso = new Date(
    now.getTime() - GENERATION_WINDOW_MS,
  ).toISOString();
  const rateKey = `${WORKSPACE_ID}:presentation-outline:${actorHash}`;
  const rate = await getD1()
    .prepare(
      `
    INSERT INTO ai_request_limits (key, workspace_id, scope, window_started_at, request_count, updated_at)
    VALUES (?, ?, 'presentation-outline', ?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      window_started_at = CASE WHEN window_started_at < ? THEN excluded.window_started_at ELSE window_started_at END,
      request_count = CASE WHEN window_started_at < ? THEN 1 ELSE request_count + 1 END,
      updated_at = excluded.updated_at
    WHERE window_started_at < ? OR request_count < ?
    RETURNING request_count
  `,
    )
    .bind(
      rateKey,
      WORKSPACE_ID,
      nowIso,
      nowIso,
      cutoffIso,
      cutoffIso,
      cutoffIso,
      GENERATION_LIMIT,
    )
    .first<{ request_count: number }>();
  if (!rate) {
    await getD1()
      .prepare(
        "DELETE FROM ai_idempotency WHERE key = ? AND status = 'pending'",
      )
      .bind(key)
      .run()
      .catch(() => undefined);
    throw new ApiRequestError(
      "Слишком много презентаций создано за короткое время. Повторите через несколько минут.",
      429,
      [`Лимит: ${GENERATION_LIMIT} генераций за 10 минут.`],
    );
  }

  return { key, replayed: null };
}

async function finishPresentationGeneration(
  key: string,
  status: "completed" | "failed",
  result?: PresentationAiResponse,
) {
  await getD1()
    .prepare(
      "UPDATE ai_idempotency SET status = ?, result_json = ?, updated_at = ? WHERE key = ?",
    )
    .bind(
      status,
      result ? JSON.stringify(result) : null,
      new Date().toISOString(),
      key,
    )
    .run()
    .catch(() => undefined);
}

async function readProviderBody(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new ApiRequestError("ИИ вернул слишком большой ответ.", 502);
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PROVIDER_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ApiRequestError("ИИ вернул слишком большой ответ.", 502);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

async function callPresentationProvider(endpoint: string, init: RequestInit) {
  try {
    const response = await fetch(endpoint, {
      ...init,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    return { response, body: await readProviderBody(response) };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ApiRequestError(
      timedOut
        ? "ИИ не ответил за 55 секунд. Поток подготовит редактируемую резервную структуру."
        : "Не удалось связаться с ИИ-провайдером. Повторите запрос позже.",
      timedOut ? 504 : 502,
    );
  }
}

function providerResponseError(status: number) {
  if (status === 429) {
    return new ApiRequestError(
      "ИИ временно перегружен. Повторите через минуту.",
      429,
    );
  }
  return new ApiRequestError(
    "ИИ не смог собрать структуру презентации. Повторите запрос.",
    status >= 500 ? 502 : 422,
  );
}

function responseSchema(slideCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name", "description", "slides"],
    properties: {
      name: { type: "string", maxLength: 120 },
      description: { type: "string", maxLength: 500 },
      slides: {
        type: "array",
        minItems: slideCount,
        maxItems: slideCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "layout",
            "eyebrow",
            "title",
            "body",
            "bullets",
            "themeId",
            "patternId",
            "imagePrompt",
            "speakerNotes",
          ],
          properties: {
            layout: {
              type: "string",
              enum: [
                "title",
                "statement",
                "split",
                "bullets",
                "quote",
                "stats",
                "timeline",
                "process",
                "comparison",
                "agenda",
                "gallery",
                "chart",
                "table",
                "callout",
                "closing",
              ],
            },
            eyebrow: { type: "string", maxLength: 120 },
            title: { type: "string", maxLength: 300 },
            body: { type: "string", maxLength: 1_500 },
            bullets: {
              type: "array",
              maxItems: 8,
              items: { type: "string", maxLength: 240 },
            },
            themeId: {
              type: "string",
              enum: [...THEMES],
            },
            patternId: {
              type: "string",
              enum: presentationPatternIds.filter(
                (pattern) => pattern !== "auto",
              ),
            },
            imagePrompt: {
              type: ["string", "null"],
              maxLength: 1_200,
            },
            speakerNotes: { type: "string", maxLength: 3_000 },
          },
        },
      },
    },
  };
}

function fallbackNarrativeSlides(
  input: ReturnType<typeof parseRequest>,
  summary: string,
  audience: string,
  facts: string,
) {
  const blueprint = presentationNarrativeBlueprint(input);
  const titles: Record<PresentationNarrativeScenario, string[]> = {
    pitch: [
      "Проблема становится дорогой, когда разрывает ключевой рабочий процесс",
      "Прежний подход не даёт управлять причиной, а только устраняет последствия",
      "Новый принцип решения связывает действие с проверяемым результатом",
      "Ценность раскрывается в одном конкретном сценарии использования",
      "Доверие создаёт не обещание, а понятный механизм проверки",
      "Первый шаг должен снижать главный риск решения",
      "Решение можно принять по заранее согласованным критериям",
    ],
    strategy: [
      "Главное ограничение стратегии — конкуренция инициатив за один ресурс",
      "Сильная ставка начинается с выбора, от чего команда сознательно отказывается",
      "Приоритеты работают только как связанная система решений",
      "Последовательность важнее одновременного запуска всех инициатив",
      "Каждая ставка требует владельца и наблюдаемого сигнала",
      "Риски нужно привязать к точкам управленческого контроля",
      "Следующий цикл начинается с одного приоритета",
    ],
    report: [
      "Главный вывод должен быть понятен до просмотра всех данных",
      "Изменение важно отделить от случайного колебания",
      "Причина ценнее самой цифры, потому что определяет действие",
      "Отклонение становится управляемым после сравнения с контекстом",
      "Данные должны менять решение, а не просто заполнять слайд",
      "Неизвестное нужно оформить как гипотезу для проверки",
      "Следующий отчётный цикл должен проверять выбранный сигнал",
    ],
    education: [
      "Обучение начинается с вопроса, на который слушатель пока не умеет отвечать",
      "Одна понятная модель собирает разрозненные факты в систему",
      "Механизм важнее определения, потому что позволяет переносить знание",
      "Пример показывает границу между пониманием и запоминанием",
      "Практическая задача превращает идею в навык",
      "Типичная ошибка помогает увидеть границы метода",
      "Знание закрепляется через применение к собственной задаче",
    ],
    event: [
      "Событие ценно не расписанием, а изменением состояния участника",
      "Тема становится актуальной, когда отвечает на вопрос аудитории сейчас",
      "Программа должна обещать понятный маршрут, а не набор выступлений",
      "Каждый блок события выполняет отдельную роль в опыте участника",
      "Ключевые моменты нужно связать с практическим результатом",
      "Правильная аудитория узнаёт себя до регистрации",
      "Участие начинается с одного простого действия",
    ],
    product: [
      "Рабочее напряжение точнее объясняет продукт, чем список функций",
      "Новый принцип меняет способ действия, а не только интерфейс",
      "Сценарий использования связывает возможность с результатом пользователя",
      "Ключевые функции должны собираться вокруг одной задачи",
      "Пользу подтверждает проверяемый процесс, а не рекламное обещание",
      "Внедрение безопаснее начинать с ограниченного сценария",
      "Первый результат должен быть достижим без полной перестройки процесса",
    ],
    transformation: [
      "Прежняя модель исчерпана, когда цена координации превышает её пользу",
      "Целевое состояние нужно описывать через новый способ работы",
      "Принципы перехода защищают решение от случайного набора инициатив",
      "Фазы превращают масштабное изменение в управляемую последовательность",
      "Роли и точки решения важнее общего списка участников",
      "Главный риск перехода нужно проверять раньше масштабирования",
      "Безопасный первый шаг создаёт основание для следующей фазы",
    ],
    general: [
      `${summary}: ценность темы раскрывается через конкретную задачу аудитории`,
      "Сильный вывод начинается с ясных границ известных фактов",
      "Механизм объясняет, почему результат вообще возможен",
      "Практическая ценность проявляется в изменении действия",
      "Ограничения помогают выбрать корректный сценарий",
      "Критерии проверки отделяют решение от общего ожидания",
      "Следующий шаг должен быть конкретным и проверяемым",
    ],
  };
  const layouts: PresentationSlideLayout[] = [
    "statement",
    "comparison",
    "process",
    "split",
    "bullets",
    "callout",
    "statement",
  ];
  return blueprint.narrativeArc.map((stage, index) => {
    const layout = layouts[index % layouts.length];
    const body =
      index === 0
        ? `Для аудитории «${audience}» важно связать тему «${summary}» с реальным напряжением и ценой бездействия.`
        : index === 1
          ? facts
          : index === blueprint.narrativeArc.length - 1
            ? blueprint.closingLogic
            : `${stage} раскрывается через причинную связь, конкретный сценарий и наблюдаемый результат — без неподтверждённых обещаний.`;
    const bullets =
      layout === "process"
        ? ["Определить исходное состояние", "Изменить один механизм", "Проверить результат"]
        : layout === "comparison"
          ? ["Текущее состояние", "Главное ограничение", "Целевой принцип", "Критерий перехода"]
          : layout === "bullets"
            ? ["Что уже известно", "Что остаётся гипотезой", "Как проверить", "Кто принимает решение"]
            : [];
    return {
      layout,
      eyebrow: normalizePresentationEyebrow(stage),
      title: normalizePresentationTitle(titles[blueprint.scenario][index] ?? stage),
      body: normalizePresentationBody(body),
      bullets: bullets.map(normalizePresentationBullet),
      speakerNotes: `Роль слайда: ${stage}. ${blueprint.evidencePolicy}`,
    } satisfies Pick<
      PresentationSlide,
      "layout" | "eyebrow" | "title" | "body" | "bullets" | "speakerNotes"
    >;
  });
}

function safeFallbackOutline(input: ReturnType<typeof parseRequest>) {
  const rawSummary =
    input.goal.split(/[.!?\n]/)[0]?.trim() || "Новая презентация";
  const topic = rawSummary
    .replace(
      /^(?:сделай|создай|подготовь|нужна|нужно сделать)\s+(?:мне\s+)?(?:презентацию|доклад)(?:\s+на\s+тему)?\s*[:—-]?\s*/i,
      "",
    )
    .replace(/^на\s+тему\s*[:—-]?\s*/i, "")
    .trim();
  const summary = (topic || rawSummary).slice(0, 120).trim();
  const audience = input.audience || "целевая аудитория";
  const facts =
    input.context?.trim() ||
    "Числовые и фактические данные не предоставлены, поэтому вывод строится через механизм, ограничения и критерии проверки без выдуманных показателей.";
  const action = input.desiredAction?.trim() || "Согласовать следующий шаг";
  const digitalRubleTopic =
    /цифров(?:ой|ого|ому|ым|ом)\s+рубл|цифров(?:ая|ой)\s+валют.*центральн/i.test(
      `${summary} ${input.context ?? ""}`,
    );
  if (digitalRubleTopic) {
    const digitalRubleSlides: PresentationSlide[] = [
      {
        id: newId("slide"),
        layout: "title",
        eyebrow: "ЦИФРОВОЙ РУБЛЬ",
        title: "Цифровой рубль: как устроена третья форма российской валюты",
        body: input.audience
          ? `Практическое объяснение для аудитории: ${input.audience}`
          : "Механика, сценарии применения и вопросы внедрения",
        bullets: [],
        speakerNotes:
          "Сразу отделите цифровой рубль от криптовалют: это форма национальной валюты, а не отдельный инвестиционный актив.",
      },
      {
        id: newId("slide"),
        layout: "statement",
        eyebrow: "ГЛАВНАЯ МЫСЛЬ",
        title:
          "Новая форма денег меняет инфраструктуру расчётов, но не номинал рубля",
        body: "Цифровой рубль дополняет наличные и безналичные деньги. Его практическая ценность определяется не названием технологии, а тем, как будут устроены кошелёк, перевод и интеграция с привычными финансовыми процессами.",
        bullets: [],
        speakerNotes:
          "Не обещайте автоматических выгод: для каждого сценария важны правила доступа, стоимость интеграции и операционная готовность.",
      },
      {
        id: newId("slide"),
        layout: "split",
        eyebrow: "ТРИ ФОРМЫ",
        title: "Разница — в способе хранения и проведения операции",
        body: "Наличные существуют физически, безналичные учитываются на банковских счетах, а цифровая форма предполагает отдельную инфраструктуру учёта и цифровой кошелёк.",
        bullets: [
          "Наличные: прямой физический расчёт",
          "Безналичные: банковский счёт и платёжная система",
          "Цифровые: кошелёк и единая инфраструктура",
        ],
        speakerNotes:
          "Покажите отличие на одном бытовом сценарии — например, оплате поставщику или переводу между организациями.",
      },
      {
        id: newId("slide"),
        layout: "bullets",
        eyebrow: "СЦЕНАРИИ",
        title:
          "Польза появляется в процессах, где важны прозрачность и управляемость расчёта",
        body: "Оценивать технологию стоит через конкретный процесс, а не через общий интерес к цифровым финансам.",
        bullets: [
          "Расчёты между гражданами и организациями",
          "Автоматизация отдельных условий платежа",
          "Контроль движения средств в согласованном сценарии",
          "Интеграция с государственными и корпоративными системами",
        ],
        speakerNotes:
          "Каждый сценарий требует проверки действующих правил и возможностей платформы на момент внедрения.",
      },
      {
        id: newId("slide"),
        layout: "split",
        eyebrow: "ГОТОВНОСТЬ",
        title: "Техническая доступность не равна готовности бизнеса",
        body: "Нужно определить владельца процесса, обновить интеграции, права доступа и контроль операций, а также подготовить поддержку пользователей.",
        bullets: [
          "ИТ-интеграция",
          "Юридическая модель",
          "Бухгалтерский учёт",
          "Информационная безопасность",
          "Обучение сотрудников",
        ],
        speakerNotes:
          "Переведите обсуждение из уровня тренда в список конкретных изменений процесса.",
      },
      {
        id: newId("slide"),
        layout: "bullets",
        eyebrow: "ВОПРОСЫ И РИСКИ",
        title:
          "До пилота нужно проверить ограничения, ответственность и устойчивость",
        body: "Критичны не только технология, но и порядок восстановления доступа, обработка ошибок и разделение ответственности между участниками.",
        bullets: [
          "Кто и как управляет доступом к кошельку?",
          "Что происходит при ошибочной операции?",
          "Как обеспечивается непрерывность расчётов?",
          "Какие данные видят участники процесса?",
          "Какие правила действуют именно сейчас?",
        ],
        speakerNotes:
          "Не давайте юридических или финансовых обещаний без проверки актуальных нормативных документов.",
      },
      {
        id: newId("slide"),
        layout: "closing",
        eyebrow: "СЛЕДУЮЩИЙ ШАГ",
        title: action,
        body: "Выберите один реальный платёжный процесс, проверьте актуальные правила и оцените интеграцию до масштабирования.",
        bullets: [],
        speakerNotes:
          "Завершите конкретным действием, указанным пользователем, или предложите рабочую сессию по выбору пилотного сценария.",
      },
    ];
    return {
      name: "Цифровой рубль: механика и применение",
      description:
        "Содержательная презентация о принципах работы цифрового рубля, сценариях применения и критериях готовности.",
      slides: digitalRubleSlides
        .slice(0, Math.max(3, input.slideCount - 1))
        .concat(digitalRubleSlides.at(-1)!)
        .slice(0, input.slideCount),
    };
  }
  const cryptoTopic = /крипт|биткоин|блокчейн|цифров(?:ая|ые) валют/i.test(
    `${summary} ${input.context ?? ""}`,
  );
  if (cryptoTopic) {
    const cryptoSlides: PresentationSlide[] = [
      {
        id: newId("slide"),
        layout: "title",
        eyebrow: "КРИПТОВАЛЮТЫ",
        title: "Криптовалюты: возможности, риски и осознанные решения",
        body: input.audience
          ? `Практический обзор для аудитории: ${input.audience}`
          : "Практический обзор без инвестиционных обещаний",
        bullets: [],
        speakerNotes:
          "Начните с цели: разобраться в механике и критериях решения, а не угадать цену актива.",
      },
      {
        id: newId("slide"),
        layout: "statement",
        eyebrow: "ОСНОВА",
        title:
          "Криптовалюта — цифровой актив, учёт которого ведёт распределённая сеть",
        body: "Передача прав фиксируется в блокчейне, а доступ к активу подтверждается криптографическим ключом. Банк не является обязательным посредником, но ответственность за хранение и проверку операций возрастает.",
        bullets: [],
        speakerNotes:
          "Разделите понятия: актив, блокчейн, кошелёк и биржа — это не одно и то же.",
      },
      {
        id: newId("slide"),
        layout: "split",
        eyebrow: "КАК ЭТО РАБОТАЕТ",
        title: "Операция проходит путь от подписи до подтверждения сетью",
        body: "Пользователь подписывает перевод приватным ключом. Узлы сети проверяют операцию, после чего запись включается в блок и становится частью общей истории.",
        bullets: [
          "Кошелёк хранит ключи, а не монеты",
          "Адрес служит реквизитом получателя",
          "Правила подтверждения зависят от сети",
        ],
        speakerNotes:
          "Подчеркните: потеря ключа и ошибка в адресе могут быть необратимыми.",
      },
      {
        id: newId("slide"),
        layout: "bullets",
        eyebrow: "ВОЗМОЖНОСТИ",
        title:
          "Ценность появляется там, где программируемость важнее привычного посредника",
        body: "Технология применима не только к оплате: она позволяет задавать правила владения и исполнения операций в коде.",
        bullets: [
          "Международные переводы",
          "Токенизация цифровых и реальных прав",
          "Смарт-контракты и автоматизация расчётов",
          "Доступ к децентрализованным сервисам",
        ],
        speakerNotes:
          "Не называйте каждое применение выгодным: полезность зависит от юрисдикции, стоимости и конкретного сценария.",
      },
      {
        id: newId("slide"),
        layout: "split",
        eyebrow: "РИСКИ",
        title:
          "Главные риски связаны не только с ценой, но и с контролем доступа",
        body: "Высокая волатильность заметна первой, однако критичны также ошибки хранения, мошенничество, технические уязвимости и изменение правовых требований.",
        bullets: [
          "Рыночный риск",
          "Потеря или компрометация ключей",
          "Риск контрагента и биржи",
          "Налоги и регулирование",
        ],
        speakerNotes:
          "Отделите риск самого протокола от риска сервиса, через который пользователь покупает или хранит актив.",
      },
      {
        id: newId("slide"),
        layout: "bullets",
        eyebrow: "ПРОВЕРКА РЕШЕНИЯ",
        title: "До использования нужно ответить на пять практических вопросов",
        body: "Решение должно начинаться со сценария и допустимого риска, а не с выбора популярной монеты.",
        bullets: [
          "Какую задачу решает актив?",
          "Кто контролирует приватные ключи?",
          "Как проверяется контрагент?",
          "Какие комиссии и ограничения действуют?",
          "Каковы правовые и налоговые последствия?",
        ],
        speakerNotes:
          "Эти вопросы превращают обсуждение из эмоционального в управляемое.",
      },
      {
        id: newId("slide"),
        layout: "closing",
        eyebrow: "ВЫВОД",
        title: action,
        body: "Выберите один сценарий, проверьте правовые условия и начните с суммы или процесса, потеря которого не создаст критического ущерба.",
        bullets: [],
        speakerNotes:
          "Завершите конкретным действием, указанным пользователем, либо предложите отдельную оценку сценария.",
      },
    ];
    return {
      name: "Криптовалюты: возможности и риски",
      description:
        "Содержательная презентация о принципах работы криптовалют, сценариях применения, рисках и критериях принятия решения.",
      slides: cryptoSlides
        .slice(0, Math.max(3, input.slideCount - 1))
        .concat(cryptoSlides.at(-1)!)
        .slice(0, input.slideCount),
    };
  }
  const commonMiddle: Array<
    Pick<PresentationSlide, "layout" | "eyebrow" | "title" | "body" | "bullets"> &
      Partial<Pick<PresentationSlide, "speakerNotes">>
  > = [
    {
      layout: "statement",
      eyebrow: "ГЛАВНАЯ МЫСЛЬ",
      title: `${summary}: важно отделить реальную ценность от общих ожиданий`,
      body: `Для аудитории «${audience}» тема становится полезной, когда связана с конкретной задачей, условиями применения и понятным результатом.`,
      bullets: [],
    },
    {
      layout: "split",
      eyebrow: "ЧТО УЖЕ ИЗВЕСТНО",
      title: "Исходные данные определяют границы корректного вывода",
      body: facts,
      bullets: [
        "Подтверждённые факты",
        "Рабочие предположения",
        "Вопросы для проверки",
      ],
    },
    {
      layout: "bullets",
      eyebrow: "КАК ЭТО УСТРОЕНО",
      title: `Тему «${summary}» стоит разбирать через механизм, участников и результат`,
      body: "Так обсуждение переходит от впечатления к причинно-следственной логике.",
      bullets: [
        "Как запускается процесс",
        "Кто влияет на результат",
        "Где возникают ограничения",
        "Как проверить эффект",
      ],
    },
    {
      layout: "split",
      eyebrow: "ПРАКТИЧЕСКАЯ ЦЕННОСТЬ",
      title: "Польза возникает только в конкретном сценарии применения",
      body: `Для аудитории «${audience}» нужно показать изменение рабочего процесса, а не перечислять свойства темы.`,
      bullets: [
        "Задача до изменения",
        "Новый способ действия",
        "Наблюдаемый результат",
      ],
    },
    {
      layout: "bullets",
      eyebrow: "ВОЗМОЖНОСТИ",
      title: "Сильные сценарии объединяет измеримая польза для участника",
      body: "Приоритет получают применения, где понятны владелец, действие и критерий результата.",
      bullets: [
        "Ускорение понятного процесса",
        "Снижение ручной нагрузки",
        "Повышение прозрачности решения",
        "Новый доступный сценарий",
      ],
    },
    {
      layout: "bullets",
      eyebrow: "ОГРАНИЧЕНИЯ И РИСКИ",
      title:
        "До применения нужно проверить цену ошибки и границы ответственности",
      body: "Риски определяются не только технологией, но и процессом, данными и действиями людей.",
      bullets: [
        "Качество исходных данных",
        "Контроль и проверка результата",
        "Правовые и организационные ограничения",
        "Сценарий восстановления после ошибки",
      ],
    },
    {
      layout: "statement",
      eyebrow: "КРИТЕРИЙ ВЫБОРА",
      title:
        "Решение стоит принимать по качеству результата, а не по новизне подхода",
      body: "Сравните текущий и новый сценарий по точности, скорости, стоимости и управляемости риска.",
      bullets: [],
    },
    {
      layout: "split",
      eyebrow: "ПРАКТИЧЕСКАЯ ПРОВЕРКА",
      title:
        "Первый шаг должен проверять главный риск, а не охватывать всю систему",
      body: "Выберите один сценарий и заранее определите, какой результат подтвердит ценность подхода.",
      bullets: [
        "Один реальный процесс",
        "Ограниченный круг участников",
        "Измеримый критерий",
      ],
    },
    {
      layout: "bullets",
      eyebrow: "ЧТО НУЖНО РЕШИТЬ",
      title: "До следующего шага достаточно согласовать четыре условия",
      body: `Эти условия переводят тему «${summary}» в управляемое решение.`,
      bullets: [
        "Какую задачу решаем",
        "Кто отвечает за результат",
        "Какие ограничения обязательны",
        "Когда и как оцениваем эффект",
      ],
    },
    {
      layout: "statement",
      eyebrow: "ВЫВОД",
      title: `${summary}: следующий шаг должен быть конкретным и проверяемым`,
      body: `Рекомендуемое действие: ${action}.`,
      bullets: [],
    },
  ];
  const middle = [
    ...fallbackNarrativeSlides(input, summary, audience, facts),
    ...commonMiddle,
  ];
  const middleCount = Math.max(1, input.slideCount - 2);
  const selected = Array.from(
    { length: middleCount },
    (_, index) => middle[index % middle.length],
  );
  const slides: PresentationSlide[] = [
    {
      id: newId("slide"),
      layout: "title",
      eyebrow: "ПРЕЗЕНТАЦИЯ",
      title: summary,
      body: input.audience
        ? `Практический разбор для аудитории: ${input.audience}`
        : "Практический разбор: механизм, возможности, риски и решение",
      bullets: [],
      speakerNotes:
        "Начните с центрального напряжения аудитории и назовите один вывод, который она должна унести с собой.",
    },
    ...selected.map((slide) => ({
      ...slide,
      id: newId("slide"),
      speakerNotes:
        slide.speakerNotes ||
        "Свяжите тезис с задачей аудитории и отделите подтверждённый факт от предположения.",
      bullets: [...slide.bullets],
    })),
    {
      id: newId("slide"),
      layout: "closing",
      eyebrow: "СЛЕДУЮЩИЙ ШАГ",
      title: action,
      body: `По теме «${summary}» зафиксируйте владельца действия, срок и критерий результата.`,
      bullets: [],
      speakerNotes:
        "Завершите одним решением и ближайшим действием. Не пересказывайте предыдущие слайды.",
    },
  ];
  return {
    name: summary,
    description: "Связная редактируемая структура без выдуманных фактов.",
    slides,
  };
}

export async function presentationAiStatus(
  request: Request,
): Promise<PresentationAiResponse> {
  await ensureDatabase(request);
  const selected = provider();
  return {
    configured: Boolean(selected),
    ...(selected ? { provider: selected.provider } : {}),
  };
}

export async function generatePresentationOutline(
  request: Request,
  value: unknown,
): Promise<PresentationAiResponse> {
  await ensureDatabase(request);
  const selected = provider();
  if (!selected)
    throw new ApiRequestError(
      "Сначала подключите ИИ-провайдера в настройках платформы.",
      503,
    );
  const input = parseRequest(value);
  const reservation = await reservePresentationGeneration(request, input);
  if (reservation.replayed) return reservation.replayed;
  try {
    const selectedThemeId = resolvedThemeId(input);
    const theme = { ...presentationTheme(selectedThemeId), ...requestedPresentationColors(input.designBrief) };
    const narrativeBlueprint = presentationNarrativeBlueprint(input);
    const templateBlueprint = selectedPresentationTemplate(input);
    const sourceRule = templateBlueprint
      ? `Режим композиции — адаптация библиотечного сценария «${templateBlueprint.name}». Сохрани последовательность layout, смену плотности, визуальную тему и паттерны templateBlueprint. При этом полностью перепиши старые заголовки, аргументы, факты и заметки под новую задачу. Это новая презентация в проверенной дизайн-системе, а не копия исходного текста.`
      : "Режим композиции — полностью оригинальная арт-дирекция. Не воспроизводи готовый шаблон библиотеки: самостоятельно спроектируй сюжет, чередование макетов и визуальный ритм по narrativeBlueprint.";
    const instructions = `Ты — senior presentation designer и редактор. Создай законченную русскоязычную презентацию по задаче пользователя. Ответ — один JSON: name, description, slides. У каждого слайда обязательны layout, eyebrow, title, body, bullets, themeId, patternId, imagePrompt, speakerNotes.
${sourceRule}
Сначала выбери одну визуальную идею для всего доклада: типографическая редакционная, контрастная продуктовая, спокойная аналитическая, предметная визуальная или другая, соответствующая designBrief. Строй различия композицией и плотностью, а не случайными цветами и узорами. Не делай весь доклад набором одинаковых скруглённых карточек. selectedTheme — базовая тема, сохраняй её на слайдах. Чередуй крупный тезис, данные, сравнение и процесс лишь там, где это помогает содержанию. Узоры необязательны: patternId=none подходит для большинства текстовых и аналитических слайдов. Максимум два родственных орнамента во всей презентации; просьба без узоров означает none везде.
Ровно ${input.slideCount} слайдов, включая title первым и closing последним. У каждого одна функция и конкретный предмет. Название процесса может быть короткой именной фразой; для результатов уместен вывод. Не превращай все заголовки в длинные лозунги. Не повторяй один layout больше двух раз подряд. narrativeBlueprint помогает связать повествование, но не требует выдумывать содержание для каждой стадии.
layoutContracts описывает РЕАЛЬНЫЕ места под текст и иллюстрации и является обязательным ограничением. Соблюдай лимит символов title/body и число/длину bullets для выбранного layout. Текст, который не вмещается, изложи в speakerNotes полными предложениями. Не обрывай слова и не добавляй многоточие. Не клади текст в поле, которое макет не показывает. split использует справа либо картинку, либо список; не оба. chart/stats: каждый bullet в формате число|подпись, только сопоставимые подтверждённые данные.
imagePrompt нужен только если предметная иллюстрация помогает смыслу, от нуля до двух слайдов. gallery требует изображение; title может быть чисто типографическим. Если пользователь просит без изображений, imagePrompt=null везде. Не иллюстрируй числа декоративными картинками. Описание изображения задаёт конкретный предмет, композицию, свет, материал; без надписей и выдуманных логотипов. Не добавляй изображения на макеты без места под них.
Факты, числа, даты, названия и ссылки используй только из пользовательского контекста. Не выдумывай достижения, клиентов, цитаты, источники, стоимость или гарантии. Сохрани единицы измерения и смысл сравнения. Обычные объяснения механизмов допустимы; предположения обозначай. Не пиши технических заглушек, инструкций дизайнеру и комментариев о проверке качества.
Перед ответом проверь целостность стиля, разнообразие силуэтов, отсутствие лишних карточек и точность фактов. Верни весь JSON без Markdown.`;
    const modelInput = {
      userGoal: input.goal,
      audience: input.audience || "Аудитория указана в задаче пользователя",
      factualContext:
        input.context ||
        "Дополнительные факты не предоставлены — не выдумывать их",
      desiredAudienceAction:
        input.desiredAction ||
        "Сформулировать уместный следующий шаг из задачи пользователя",
      presentationTone: input.tone,
      narrativeBlueprint,
      layoutContracts: presentationLayoutContracts,
      creativeSource: input.creativeSource,
      templateBlueprint: templateBlueprint
        ? {
            id: templateBlueprint.id,
            name: templateBlueprint.name,
            useCase: templateBlueprint.useCase,
            description: templateBlueprint.description,
            themeId: templateBlueprint.themeId,
            slides: templateBlueprint.slides.map((slide) => ({
              layout: slide.layout,
              themeId: slide.themeId ?? templateBlueprint.themeId,
              patternId: slide.patternId ?? "auto",
              role: slide.eyebrow,
            })),
          }
        : undefined,
      slideCount: input.slideCount,
      selectedTheme: selectedThemeId,
      requestedColors: requestedPresentationColors(input.designBrief),
      visualDesignBrief:
        input.designBrief ||
        "Выразительный, но деловой дизайн с аккуратными узорами и достаточным контрастом",
      availableThemes: [...THEMES],
      patternLibrary: presentationPatternCatalog
        .filter((pattern) => pattern.id !== "auto")
        .map((pattern) => ({
          id: pattern.id,
          name: pattern.label,
          category: pattern.category,
        })),
      exactAction: {
        label: input.ctaLabel,
        url: input.ctaUrl,
        socialLinks: input.socialLinks,
      },
    };
    const schema = responseSchema(input.slideCount);
    const requestBody = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${selected.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        selected.provider === "navyai"
          ? {
              model: selected.model,
              messages: [
                { role: "system", content: `${instructions}\nJSON-схема: ${JSON.stringify(schema)}` },
                { role: "user", content: JSON.stringify(modelInput) },
              ],
              max_tokens: Math.max(6_000, input.slideCount * 700),
              reasoning_effort: "medium",
              response_format: { type: "json_schema", json_schema: { name: "presentation_outline", strict: true, schema } },
            }
          : {
              model: selected.model,
              store: false,
              safety_identifier: await safetyIdentifier(request),
              reasoning: { effort: "medium" },
              max_output_tokens: Math.max(6_000, input.slideCount * 700),
              instructions,
              input: JSON.stringify(modelInput),
              text: {
                format: {
                  type: "json_schema",
                  name: "presentation_outline",
                  strict: true,
                  schema,
                },
              },
            },
      ),
    } satisfies RequestInit;
    let { response, body: responseBody } = await callPresentationProvider(
      selected.endpoint,
      requestBody,
    );
    if (
      !response.ok &&
      response.status !== 429 &&
      selected.provider === "navyai" &&
      selected.fallbackModel &&
      selected.model !== selected.fallbackModel
    ) {
      const fallbackBody = {
        ...(JSON.parse(String(requestBody.body)) as Record<string, unknown>),
        model: selected.fallbackModel,
      };
      ({ response, body: responseBody } = await callPresentationProvider(
        selected.endpoint,
        { ...requestBody, body: JSON.stringify(fallbackBody) },
      ));
    }
    if (!response.ok) {
      console.error("Presentation AI error", response.status);
      throw providerResponseError(response.status);
    }
    let parsed: Record<string, unknown>;
    let slides: PresentationSlide[];
    let usedTopicFallback = false;
    try {
      parsed = parseJson(outputText(responseBody));
      slides = applyPresentationTemplateBlueprint(parseSlides(parsed.slides, input.slideCount), input);
    } catch {
      const raw = JSON.parse(String(requestBody.body)) as Record<
        string,
        unknown
      >;
      const retryInstructions = `${instructions}\nJSON-схема: ${JSON.stringify(schema)}\nПРЕДЫДУЩАЯ ПОПЫТКА НАРУШИЛА ФОРМАТ. Верни только один валидный JSON-объект без Markdown, вводного текста и комментариев. Проверь количество слайдов и обязательные поля.`;
      const retryBody =
        selected.provider === "navyai"
          ? {
              ...raw,
              model: selected.model,
              messages: [
                { role: "system", content: retryInstructions },
                { role: "user", content: JSON.stringify(modelInput) },
              ],
            }
          : {
              ...raw,
              reasoning: { effort: "medium" },
              instructions: retryInstructions,
            };
      try {
        const retry = await callPresentationProvider(selected.endpoint, {
          ...requestBody,
          body: JSON.stringify(retryBody),
        });
        if (!retry.response.ok)
          throw providerResponseError(retry.response.status);
        parsed = parseJson(outputText(retry.body));
        slides = applyPresentationTemplateBlueprint(parseSlides(parsed.slides, input.slideCount), input);
      } catch (retryError) {
        if (
          retryError instanceof ApiRequestError &&
          (retryError.status === 429 || retryError.status === 504)
        ) {
          throw retryError;
        }
        const fallback = safeFallbackOutline(input);
        parsed = { name: fallback.name, description: fallback.description };
        slides = fallback.slides;
        usedTopicFallback = true;
      }
    }
    const qualityIssues = usedTopicFallback
      ? []
      : presentationQualityIssues(slides, input);
    if (qualityIssues.length) {
      const raw = JSON.parse(String(requestBody.body)) as Record<
        string,
        unknown
      >;
      const repairInstructions = `${instructions}\nJSON-схема: ${JSON.stringify(schema)}\nПРЕДЫДУЩИЙ ЧЕРНОВИК ФОРМАЛЬНО ВАЛИДЕН, НО НЕ ПРОШЁЛ РЕДАКТОРСКИЙ КОНТРОЛЬ. Исправь перечисленные qualityIssues, сохрани только подтверждённые факты и верни заново полный JSON со всеми ${input.slideCount} слайдами. Не объясняй правки.`;
      const repairInput = {
        ...modelInput,
        qualityIssues,
        previousDraft: {
          name: optionalModelText(parsed.name, "Название презентации", 120),
          description: optionalModelText(
            parsed.description,
            "Описание презентации",
            500,
          ),
          slides,
        },
      };
      const repairBody =
        selected.provider === "navyai"
          ? {
              ...raw,
              model: selected.model,
              messages: [
                { role: "system", content: repairInstructions },
                { role: "user", content: JSON.stringify(repairInput) },
              ],
            }
          : {
              ...raw,
              reasoning: { effort: "medium" },
              instructions: repairInstructions,
              input: JSON.stringify(repairInput),
            };
      try {
        const repair = await callPresentationProvider(selected.endpoint, {
          ...requestBody,
          body: JSON.stringify(repairBody),
        });
        if (repair.response.ok) {
          const repairedParsed = parseJson(outputText(repair.body));
          const repairedSlides = parseSlides(
            repairedParsed.slides,
            input.slideCount,
          );
          if (
            presentationQualityIssues(repairedSlides, input).length <
            qualityIssues.length
          ) {
            parsed = repairedParsed;
            slides = repairedSlides;
          }
        }
      } catch {
        // Keep the valid first draft; deterministic art direction below still
        // supplies patterns, image roles and readable content budgets.
      }
    }
    slides = applyPresentationArtDirection(
      slides,
      input,
      selectedThemeId,
    );
    slides = applyPresentationTemplateBlueprint(slides, input);
    slides = await generatePresentationImages(request, selected, slides);
    slides = slides.map((slide) => slide.layout === "gallery" && !slide.imageUrl ? { ...slide, layout: "statement" as const } : slide);
    const lastSlide = slides.at(-1);
    if (lastSlide)
      slides[slides.length - 1] = {
        ...lastSlide,
        ...(input.ctaLabel ? { ctaLabel: input.ctaLabel } : {}),
        ...(input.ctaUrl ? { ctaUrl: input.ctaUrl } : {}),
        ...(input.socialLinks?.length
          ? { socialLinks: input.socialLinks }
          : {}),
      };
    const result: PresentationAiResponse = {
      configured: true,
      provider: selected.provider,
      generationMode: usedTopicFallback ? "topic_fallback" : "provider",
      ...(usedTopicFallback
        ? {
            generationNotice:
              "Ответ ИИ не прошёл проверку структуры, поэтому Поток собрал содержательную редактируемую версию по теме запроса.",
          }
        : {}),
      outline: {
        name:
          optionalModelText(parsed.name, "Название презентации", 120) ||
          input.goal.split(/[.!?\n]/)[0]?.slice(0, 120) ||
          "Новая презентация",
        description:
          optionalModelText(parsed.description, "Описание презентации", 500) ??
          "Создано ИИ-помощником Поток.",
        themeId: selectedThemeId,
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
        slides,
      },
    };
    await finishPresentationGeneration(reservation.key, "completed", result);
    return result;
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 504 || error.status === 502 || error.status === 422)
    ) {
      const selectedThemeId = resolvedThemeId(input);
      const theme = { ...presentationTheme(selectedThemeId), ...requestedPresentationColors(input.designBrief) };
      const fallback = safeFallbackOutline(input);
      fallback.slides = applyPresentationArtDirection(
        fallback.slides,
        input,
        selectedThemeId,
      );
      fallback.slides = applyPresentationTemplateBlueprint(
        fallback.slides,
        input,
      );
      fallback.slides = await generatePresentationImages(
        request,
        selected,
        fallback.slides,
      );
      const fallbackLast = fallback.slides.at(-1);
      if (fallbackLast)
        fallback.slides[fallback.slides.length - 1] = {
          ...fallbackLast,
          ...(input.ctaLabel ? { ctaLabel: input.ctaLabel } : {}),
          ...(input.ctaUrl ? { ctaUrl: input.ctaUrl } : {}),
          ...(input.socialLinks?.length
            ? { socialLinks: input.socialLinks }
            : {}),
        };
      const result: PresentationAiResponse = {
        configured: true,
        provider: selected.provider,
        generationMode: "topic_fallback",
        generationNotice:
          "ИИ-провайдер не ответил вовремя, поэтому Поток подготовил содержательную редактируемую версию по теме запроса.",
        outline: {
          ...fallback,
          themeId: selectedThemeId,
          accentColor: theme.accentColor,
          backgroundColor: theme.backgroundColor,
          textColor: theme.textColor,
        },
      };
      await finishPresentationGeneration(reservation.key, "completed", result);
      return result;
    }
    await finishPresentationGeneration(reservation.key, "failed");
    throw error;
  }
}

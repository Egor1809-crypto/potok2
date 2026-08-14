import { env } from "cloudflare:workers";

import { getD1 } from "@/db";
import { presentationTheme } from "@/data/presentation-templates";
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
const PROVIDER_TIMEOUT_MS = 55_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;

function runtime() {
  return env as unknown as {
    NAVYAI_API_KEY?: string;
    NAVYAI_BASE_URL?: string;
    NAVYAI_PRESENTATION_MODEL?: string;
    NAVYAI_EMAIL_MODEL?: string;
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
        "gpt-5.2",
      fallbackModel: "gemini-2.5-flash-lite",
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
  return {
    goal,
    audience: optionalText(object.audience, "Аудитория", 800),
    context: optionalText(object.context, "Исходные данные", 2_000),
    desiredAction: optionalText(object.desiredAction, "Желаемое действие", 500),
    ctaLabel: optionalText(object.ctaLabel, "Текст кнопки", 100),
    ctaUrl,
    designBrief: optionalText(object.designBrief, "Пожелания к дизайну", 1_500),
    socialLinks,
    tone:
      object.tone === "persuasive" ||
      object.tone === "educational" ||
      object.tone === "visual"
        ? object.tone
        : "executive",
    slideCount:
      optionalInteger(object.slideCount, "Количество слайдов", 3, 20) ?? 7,
    themeId: rawTheme as PresentationThemeId,
  };
}

function resolvedThemeId(
  input: ReturnType<typeof parseRequest>,
): PresentationThemeId {
  const brief = `${input.designBrief ?? ""} ${input.goal}`.toLocaleLowerCase(
    "ru-RU",
  );
  if (/преми|luxur|дорог|элит|золот|графит/.test(brief)) return "premium";
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
    const title = optionalModelText(
      object.title,
      `Заголовок слайда ${index + 1}`,
      300,
    );
    if (!title) return [];
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
    const bullets = Array.isArray(object.bullets)
      ? object.bullets
          .slice(0, 8)
          .flatMap((item) =>
            typeof item === "string" && item.trim()
              ? [item.trim().slice(0, 240)]
              : [],
          )
      : [];
    return [
      {
        id: newId("slide"),
        layout,
        eyebrow:
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
        title,
        body:
          optionalModelText(object.body, `Текст слайда ${index + 1}`, 1_500) ??
          "",
        bullets,
        speakerNotes:
          optionalModelText(
            object.speakerNotes,
            `Заметки слайда ${index + 1}`,
            3_000,
          ) ?? "",
      } satisfies PresentationSlide,
    ];
  });
  if (slides.length < Math.min(3, expectedCount))
    throw new ApiRequestError(
      "ИИ вернул слишком мало содержательных слайдов. Повторите запрос.",
      502,
    );
  slides[0] = { ...slides[0], layout: "title" };
  slides[slides.length - 1] = {
    ...slides[slides.length - 1],
    layout: "closing",
  };
  for (let index = 1; index < slides.length - 1; index += 1) {
    if (slides[index].layout !== slides[index - 1].layout) continue;
    const bodyParts = slides[index].body
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (slides[index].bullets.length >= 2) {
      slides[index] = { ...slides[index], layout: "bullets" };
    } else if (bodyParts.length >= 2) {
      slides[index] = {
        ...slides[index],
        layout: "split",
        body: bodyParts[0],
        bullets: bodyParts.slice(1, 5),
      };
    }
  }
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

  void getD1()
    .prepare("DELETE FROM ai_idempotency WHERE updated_at < ?")
    .bind(new Date(now.getTime() - 48 * 60 * 60 * 1_000).toISOString())
    .run()
    .catch(() => undefined);
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
        minItems: Math.min(3, slideCount),
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
            speakerNotes: { type: "string", maxLength: 3_000 },
          },
        },
      },
    },
  };
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
    "Подтверждённые данные не указаны; этот слайд нужно дополнить фактами перед показом.";
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
  const middle: Array<
    Pick<PresentationSlide, "layout" | "eyebrow" | "title" | "body" | "bullets">
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
      speakerNotes: "",
    },
    ...selected.map((slide) => ({
      ...slide,
      id: newId("slide"),
      speakerNotes: "",
      bullets: [...slide.bullets],
    })),
    {
      id: newId("slide"),
      layout: "closing",
      eyebrow: "СЛЕДУЮЩИЙ ШАГ",
      title: action,
      body: `По теме «${summary}» зафиксируйте владельца действия, срок и критерий результата.`,
      bullets: [],
      speakerNotes: "",
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
    const theme = presentationTheme(selectedThemeId);
    const instructions = `Ты — senior presentation designer и стратегический редактор. Создай на русском языке законченную профессиональную презентацию уровня сильной продуктовой/консалтинговой команды, а не набор текстовых карточек и не пересказ анкеты.

Сначала молча определи: тему, реальную задачу аудитории, главный тезис, драматургию и визуальную систему. Затем раскрой тему самостоятельно, используя общеизвестные определения, механизмы, сценарии, возможности, ограничения и риски. Поля пользователя — контекст и ограничения, а не текст для копирования. Не выдумывай конкретные цифры, даты, отзывы, клиентов или результаты; цитаты тоже разрешены только из подтверждённого контекста.

Драматургия: сильный вход → почему тема важна сейчас → как устроено → практические сценарии → ограничения/риски → критерии решения → ясный финал. У каждого слайда один вывод и своя функция. Заголовок должен сообщать вывод, а не называться «Возможности», «Риски» или «Итоги». Не делай agenda и не пиши заглушки «добавьте факты», «нужно показать», «согласуйте пилот».

Композиция должна меняться осмысленно: title только первый, closing только последний; statement — один тезис; split — текст и изображение; bullets — система; timeline — этапы во времени; process — последовательность действий; comparison — честное сравнение; agenda — структура выступления; gallery — визуальная история; chart и stats — только подтверждённые числа; table — компактная матрица; callout — важное предупреждение или вывод; quote — только предоставленная реальная цитата. Не повторяй layout более двух раз подряд. Для визуальной подачи чередуй крупный тезис, структурный слайд, контраст/сравнение и практический слайд. visualDesignBrief обязателен: он определяет арт-направление, характер узоров, контраст, плотность и ритм. «Премиальный» означает сдержанную типографику, графит/слоновую кость, тонкие линии и золотой акцент — не фиолетовый шаблон и не россыпь одинаковых точек.

Тексты должны помещаться без уменьшения до нечитаемого размера: title до 80 знаков, body до 280 знаков, максимум 4 bullets по 90 знаков. eyebrow — короткая смысловая метка. speakerNotes — 1–3 полезных предложения для выступающего, не повтор текста. Верни ровно ${input.slideCount} слайдов.

Ответ — только один JSON-объект с name, description и slides; у каждого слайда обязательны layout, eyebrow, title, body, bullets, speakerNotes. Никаких Markdown и комментариев.`;
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
      slideCount: input.slideCount,
      selectedTheme: selectedThemeId,
      visualDesignBrief:
        input.designBrief ||
        "Выразительный, но деловой дизайн с аккуратными узорами и достаточным контрастом",
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
                { role: "system", content: instructions },
                { role: "user", content: JSON.stringify(modelInput) },
              ],
              max_tokens: input.slideCount > 12 ? 5_600 : 4_600,
              response_format: { type: "json_object" },
            }
          : {
              model: selected.model,
              store: false,
              safety_identifier: await safetyIdentifier(request),
              reasoning: { effort: "medium" },
              max_output_tokens: input.slideCount > 12 ? 5_600 : 4_600,
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
      slides = parseSlides(parsed.slides, input.slideCount);
    } catch {
      const raw = JSON.parse(String(requestBody.body)) as Record<
        string,
        unknown
      >;
      const retryInstructions = `${instructions}\nПРЕДЫДУЩАЯ ПОПЫТКА НАРУШИЛА ФОРМАТ. Верни только один валидный JSON-объект без Markdown, вводного текста и комментариев. Проверь количество слайдов и обязательные поля.`;
      const retryBody =
        selected.provider === "navyai"
          ? {
              ...raw,
              model: selected.fallbackModel || selected.model,
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
        slides = parseSlides(parsed.slides, input.slideCount);
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
      const theme = presentationTheme(selectedThemeId);
      const fallback = safeFallbackOutline(input);
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

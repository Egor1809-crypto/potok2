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

const THEMES = new Set<PresentationThemeId>(["atelier", "violet", "noir", "ocean", "sunrise"]);
const LAYOUTS = new Set<PresentationSlideLayout>(["title", "statement", "split", "bullets", "quote", "stats", "closing"]);
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
      model: runtime().NAVYAI_PRESENTATION_MODEL?.trim() || runtime().NAVYAI_EMAIL_MODEL?.trim() || "gpt-5.2",
      fallbackModel: "gemini-2.5-flash-lite",
    };
  }
  const openAiKey = runtime().OPENAI_API_KEY?.trim();
  return openAiKey ? {
    key: openAiKey,
    provider: "openai" as const,
    endpoint: "https://api.openai.com/v1/responses",
    model: runtime().OPENAI_PRESENTATION_MODEL?.trim() || runtime().OPENAI_EMAIL_MODEL?.trim() || "gpt-5.2",
    fallbackModel: undefined,
  } : null;
}

function parseRequest(value: unknown): Required<Pick<PresentationAiRequest, "goal" | "slideCount" | "themeId" | "tone">> & Pick<PresentationAiRequest, "audience" | "context" | "desiredAction"> {
  const object = asObject(value);
  const goal = cleanText(object.goal, "Задача презентации", 4_000);
  if (goal.length < 12) throw new ApiRequestError("Опишите задачу презентации хотя бы одним предложением.");
  const rawTheme = optionalText(object.themeId, "Тема презентации", 30) ?? "atelier";
  if (!THEMES.has(rawTheme as PresentationThemeId)) throw new ApiRequestError("Выберите допустимую тему презентации.");
  return {
    goal,
    audience: optionalText(object.audience, "Аудитория", 800),
    context: optionalText(object.context, "Исходные данные", 2_000),
    desiredAction: optionalText(object.desiredAction, "Желаемое действие", 500),
    tone: object.tone === "persuasive" || object.tone === "educational" || object.tone === "visual" ? object.tone : "executive",
    slideCount: optionalInteger(object.slideCount, "Количество слайдов", 3, 20) ?? 7,
    themeId: rawTheme as PresentationThemeId,
  };
}

function outputText(value: unknown): string {
  const object = asObject(value);
  if (typeof object.output_text === "string" && object.output_text.trim()) return object.output_text;
  if (Array.isArray(object.choices)) {
    for (const candidate of object.choices) {
      if (!candidate || typeof candidate !== "object") continue;
      const message = (candidate as { message?: unknown }).message;
      if (message && typeof message === "object" && typeof (message as { content?: unknown }).content === "string") {
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
        if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") return (item as { text: string }).text;
      }
    }
  }
  throw new ApiRequestError("ИИ не вернул структуру презентации. Повторите запрос.", 502);
}

function parseJson(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  try {
    return asObject(JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned));
  } catch {
    throw new ApiRequestError("ИИ вернул текст вместо структуры презентации. Повторите запрос.", 502);
  }
}

function optionalModelText(value: unknown, field: string, max: number) {
  return typeof value === "string" ? optionalText(value, field, max) : undefined;
}

function parseSlides(value: unknown, expectedCount: number): PresentationSlide[] {
  if (!Array.isArray(value)) throw new ApiRequestError("ИИ не вернул слайды презентации.", 502);
  const slides = value.slice(0, 20).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const object = candidate as Record<string, unknown>;
    const title = optionalModelText(object.title, `Заголовок слайда ${index + 1}`, 300);
    if (!title) return [];
    const suggestedLayouts: PresentationSlideLayout[] = ["statement", "split", "bullets", "statement", "split", "bullets"];
    const rawLayout = optionalModelText(object.layout, `Макет слайда ${index + 1}`, 30)
      ?? (index === 0 ? "title" : index === expectedCount - 1 ? "closing" : suggestedLayouts[(index - 1) % suggestedLayouts.length]);
    const layout = LAYOUTS.has(rawLayout as PresentationSlideLayout) ? rawLayout as PresentationSlideLayout : "statement";
    const bullets = Array.isArray(object.bullets)
      ? object.bullets.slice(0, 8).flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, 240)] : [])
      : [];
    return [{
      id: newId("slide"),
      layout,
      eyebrow: optionalModelText(object.eyebrow, `Надзаголовок слайда ${index + 1}`, 120)
        ?? (index === 0 ? "ПРЕЗЕНТАЦИЯ" : index === expectedCount - 1 ? "ВЫВОД" : `РАЗДЕЛ ${String(index).padStart(2, "0")}`),
      title,
      body: optionalModelText(object.body, `Текст слайда ${index + 1}`, 1_500) ?? "",
      bullets,
      speakerNotes: optionalModelText(object.speakerNotes, `Заметки слайда ${index + 1}`, 3_000) ?? "",
    } satisfies PresentationSlide];
  });
  if (slides.length < Math.min(3, expectedCount)) throw new ApiRequestError("ИИ вернул слишком мало содержательных слайдов. Повторите запрос.", 502);
  slides[0] = { ...slides[0], layout: "title" };
  slides[slides.length - 1] = { ...slides[slides.length - 1], layout: "closing" };
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
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function safetyIdentifier(request: Request) {
  const source = request.headers.get("oai-authenticated-user-id") ?? "mailflow-local-participant";
  return (await digest(source)).slice(0, 32);
}

function idempotencyHeader(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim() || crypto.randomUUID();
  if (!/^[\w.:-]{8,160}$/.test(value)) {
    throw new ApiRequestError("Заголовок Idempotency-Key содержит недопустимое значение.");
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
    .prepare("SELECT request_hash, status, result_json, updated_at FROM ai_idempotency WHERE key = ?")
    .bind(key)
    .first<IdempotencyRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash) {
    throw new ApiRequestError("Этот Idempotency-Key уже использован для другого запроса.", 409);
  }
  const stale = row.status === "pending"
    && Date.parse(row.updated_at) < Date.now() - IDEMPOTENCY_STALE_MS;
  if (stale) {
    await getD1().prepare("DELETE FROM ai_idempotency WHERE key = ? AND status = 'pending' AND updated_at = ?")
      .bind(key, row.updated_at)
      .run();
    return null;
  }
  if (row.status === "pending") {
    throw new ApiRequestError("Этот запрос уже выполняется. Дождитесь результата перед повтором.", 409);
  }
  if (row.status === "completed" && row.result_json) {
    try {
      return JSON.parse(row.result_json) as PresentationAiResponse;
    } catch {
      throw new ApiRequestError("Сохранённый результат ИИ повреждён. Повторите с новым Idempotency-Key.", 409);
    }
  }
  if (row.status === "completed") {
    throw new ApiRequestError("Этот запрос уже выполнен. Повторите с новым Idempotency-Key.", 409);
  }
  throw new ApiRequestError("Предыдущая попытка с этим ключом завершилась ошибкой. Повторите с новым Idempotency-Key.", 409);
}

async function reservePresentationGeneration(request: Request, input: ReturnType<typeof parseRequest>) {
  const rawKey = idempotencyHeader(request);
  const actor = request.headers.get("oai-authenticated-user-id")?.trim() || "mailflow-local-participant";
  const [actorHash, requestHash] = await Promise.all([
    digest(actor),
    digest(JSON.stringify(input)),
  ]);
  const key = await digest(`${WORKSPACE_ID}:presentation-outline:${actorHash}:${rawKey}`);
  const replayed = await existingPresentationRequest(key, requestHash);
  if (replayed) return { key, replayed };

  const now = new Date();
  const nowIso = now.toISOString();
  const inserted = await getD1().prepare(`
    INSERT OR IGNORE INTO ai_idempotency
      (key, workspace_id, operation, request_hash, status, asset_id, created_at, updated_at)
    VALUES (?, ?, 'presentation-outline', ?, 'pending', NULL, ?, ?)
  `).bind(key, WORKSPACE_ID, requestHash, nowIso, nowIso).run();
  if ((inserted.meta.changes ?? 0) === 0) {
    const concurrent = await existingPresentationRequest(key, requestHash);
    if (concurrent) return { key, replayed: concurrent };
    throw new ApiRequestError("Этот запрос уже выполняется. Дождитесь результата перед повтором.", 409);
  }

  const cutoffIso = new Date(now.getTime() - GENERATION_WINDOW_MS).toISOString();
  const rateKey = `${WORKSPACE_ID}:presentation-outline:${actorHash}`;
  const rate = await getD1().prepare(`
    INSERT INTO ai_request_limits (key, workspace_id, scope, window_started_at, request_count, updated_at)
    VALUES (?, ?, 'presentation-outline', ?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET
      window_started_at = CASE WHEN window_started_at < ? THEN excluded.window_started_at ELSE window_started_at END,
      request_count = CASE WHEN window_started_at < ? THEN 1 ELSE request_count + 1 END,
      updated_at = excluded.updated_at
    WHERE window_started_at < ? OR request_count < ?
    RETURNING request_count
  `).bind(
    rateKey,
    WORKSPACE_ID,
    nowIso,
    nowIso,
    cutoffIso,
    cutoffIso,
    cutoffIso,
    GENERATION_LIMIT,
  ).first<{ request_count: number }>();
  if (!rate) {
    await getD1().prepare("DELETE FROM ai_idempotency WHERE key = ? AND status = 'pending'")
      .bind(key)
      .run()
      .catch(() => undefined);
    throw new ApiRequestError(
      "Слишком много презентаций создано за короткое время. Повторите через несколько минут.",
      429,
      [`Лимит: ${GENERATION_LIMIT} генераций за 10 минут.`],
    );
  }

  void getD1().prepare("DELETE FROM ai_idempotency WHERE updated_at < ?")
    .bind(new Date(now.getTime() - 48 * 60 * 60 * 1_000).toISOString())
    .run()
    .catch(() => undefined);
  return { key, replayed: null };
}

async function finishPresentationGeneration(key: string, status: "completed" | "failed", result?: PresentationAiResponse) {
  await getD1().prepare("UPDATE ai_idempotency SET status = ?, result_json = ?, updated_at = ? WHERE key = ?")
    .bind(status, result ? JSON.stringify(result) : null, new Date().toISOString(), key)
    .run()
    .catch(() => undefined);
}

async function readProviderBody(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
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
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
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
    return new ApiRequestError("ИИ временно перегружен. Повторите через минуту.", 429);
  }
  return new ApiRequestError("ИИ не смог собрать структуру презентации. Повторите запрос.", status >= 500 ? 502 : 422);
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
          required: ["layout", "eyebrow", "title", "body", "bullets", "speakerNotes"],
          properties: {
            layout: { type: "string", enum: ["title", "statement", "split", "bullets", "quote", "stats", "closing"] },
            eyebrow: { type: "string", maxLength: 120 },
            title: { type: "string", maxLength: 300 },
            body: { type: "string", maxLength: 1_500 },
            bullets: { type: "array", maxItems: 8, items: { type: "string", maxLength: 240 } },
            speakerNotes: { type: "string", maxLength: 3_000 },
          },
        },
      },
    },
  };
}

function safeFallbackOutline(input: ReturnType<typeof parseRequest>) {
  const rawSummary = input.goal.split(/[.!?\n]/)[0]?.trim() || "Новая презентация";
  const topic = rawSummary
    .replace(/^(?:сделай|создай|подготовь|нужна|нужно сделать)\s+(?:мне\s+)?(?:презентацию|доклад)(?:\s+на\s+тему)?\s*[:—-]?\s*/i, "")
    .replace(/^на\s+тему\s*[:—-]?\s*/i, "")
    .trim();
  const summary = (topic || rawSummary).slice(0, 120).trim();
  const audience = input.audience || "целевая аудитория";
  const facts = input.context?.trim() || "Подтверждённые данные не указаны; этот слайд нужно дополнить фактами перед показом.";
  const action = input.desiredAction?.trim() || "Согласовать следующий шаг";
  const digitalRubleTopic = /цифров(?:ой|ого|ому|ым|ом)\s+рубл|цифров(?:ая|ой)\s+валют.*центральн/i.test(`${summary} ${input.context ?? ""}`);
  if (digitalRubleTopic) {
    const digitalRubleSlides: PresentationSlide[] = [
      {
        id: newId("slide"), layout: "title", eyebrow: "ЦИФРОВОЙ РУБЛЬ",
        title: "Цифровой рубль: как устроена третья форма российской валюты",
        body: input.audience ? `Практическое объяснение для аудитории: ${input.audience}` : "Механика, сценарии применения и вопросы внедрения",
        bullets: [], speakerNotes: "Сразу отделите цифровой рубль от криптовалют: это форма национальной валюты, а не отдельный инвестиционный актив.",
      },
      {
        id: newId("slide"), layout: "statement", eyebrow: "ГЛАВНАЯ МЫСЛЬ",
        title: "Новая форма денег меняет инфраструктуру расчётов, но не номинал рубля",
        body: "Цифровой рубль дополняет наличные и безналичные деньги. Его практическая ценность определяется не названием технологии, а тем, как будут устроены кошелёк, перевод и интеграция с привычными финансовыми процессами.",
        bullets: [], speakerNotes: "Не обещайте автоматических выгод: для каждого сценария важны правила доступа, стоимость интеграции и операционная готовность.",
      },
      {
        id: newId("slide"), layout: "split", eyebrow: "ТРИ ФОРМЫ",
        title: "Разница — в способе хранения и проведения операции",
        body: "Наличные существуют физически, безналичные учитываются на банковских счетах, а цифровая форма предполагает отдельную инфраструктуру учёта и цифровой кошелёк.",
        bullets: ["Наличные: прямой физический расчёт", "Безналичные: банковский счёт и платёжная система", "Цифровые: кошелёк и единая инфраструктура"],
        speakerNotes: "Покажите отличие на одном бытовом сценарии — например, оплате поставщику или переводу между организациями.",
      },
      {
        id: newId("slide"), layout: "bullets", eyebrow: "СЦЕНАРИИ",
        title: "Польза появляется в процессах, где важны прозрачность и управляемость расчёта",
        body: "Оценивать технологию стоит через конкретный процесс, а не через общий интерес к цифровым финансам.",
        bullets: ["Расчёты между гражданами и организациями", "Автоматизация отдельных условий платежа", "Контроль движения средств в согласованном сценарии", "Интеграция с государственными и корпоративными системами"],
        speakerNotes: "Каждый сценарий требует проверки действующих правил и возможностей платформы на момент внедрения.",
      },
      {
        id: newId("slide"), layout: "split", eyebrow: "ГОТОВНОСТЬ",
        title: "Техническая доступность не равна готовности бизнеса",
        body: "Нужно определить владельца процесса, обновить интеграции, права доступа и контроль операций, а также подготовить поддержку пользователей.",
        bullets: ["ИТ-интеграция", "Юридическая модель", "Бухгалтерский учёт", "Информационная безопасность", "Обучение сотрудников"],
        speakerNotes: "Переведите обсуждение из уровня тренда в список конкретных изменений процесса.",
      },
      {
        id: newId("slide"), layout: "bullets", eyebrow: "ВОПРОСЫ И РИСКИ",
        title: "До пилота нужно проверить ограничения, ответственность и устойчивость",
        body: "Критичны не только технология, но и порядок восстановления доступа, обработка ошибок и разделение ответственности между участниками.",
        bullets: ["Кто и как управляет доступом к кошельку?", "Что происходит при ошибочной операции?", "Как обеспечивается непрерывность расчётов?", "Какие данные видят участники процесса?", "Какие правила действуют именно сейчас?"],
        speakerNotes: "Не давайте юридических или финансовых обещаний без проверки актуальных нормативных документов.",
      },
      {
        id: newId("slide"), layout: "closing", eyebrow: "СЛЕДУЮЩИЙ ШАГ",
        title: action,
        body: "Выберите один реальный платёжный процесс, проверьте актуальные правила и оцените интеграцию до масштабирования.",
        bullets: [], speakerNotes: "Завершите конкретным действием, указанным пользователем, или предложите рабочую сессию по выбору пилотного сценария.",
      },
    ];
    return {
      name: "Цифровой рубль: механика и применение",
      description: "Содержательная презентация о принципах работы цифрового рубля, сценариях применения и критериях готовности.",
      slides: digitalRubleSlides.slice(0, Math.max(3, input.slideCount - 1)).concat(digitalRubleSlides.at(-1)!).slice(0, input.slideCount),
    };
  }
  const cryptoTopic = /крипт|биткоин|блокчейн|цифров(?:ая|ые) валют/i.test(`${summary} ${input.context ?? ""}`);
  if (cryptoTopic) {
    const cryptoSlides: PresentationSlide[] = [
      {
        id: newId("slide"), layout: "title", eyebrow: "КРИПТОВАЛЮТЫ",
        title: "Криптовалюты: возможности, риски и осознанные решения",
        body: input.audience ? `Практический обзор для аудитории: ${input.audience}` : "Практический обзор без инвестиционных обещаний",
        bullets: [], speakerNotes: "Начните с цели: разобраться в механике и критериях решения, а не угадать цену актива.",
      },
      {
        id: newId("slide"), layout: "statement", eyebrow: "ОСНОВА",
        title: "Криптовалюта — цифровой актив, учёт которого ведёт распределённая сеть",
        body: "Передача прав фиксируется в блокчейне, а доступ к активу подтверждается криптографическим ключом. Банк не является обязательным посредником, но ответственность за хранение и проверку операций возрастает.",
        bullets: [], speakerNotes: "Разделите понятия: актив, блокчейн, кошелёк и биржа — это не одно и то же.",
      },
      {
        id: newId("slide"), layout: "split", eyebrow: "КАК ЭТО РАБОТАЕТ",
        title: "Операция проходит путь от подписи до подтверждения сетью",
        body: "Пользователь подписывает перевод приватным ключом. Узлы сети проверяют операцию, после чего запись включается в блок и становится частью общей истории.",
        bullets: ["Кошелёк хранит ключи, а не монеты", "Адрес служит реквизитом получателя", "Правила подтверждения зависят от сети"],
        speakerNotes: "Подчеркните: потеря ключа и ошибка в адресе могут быть необратимыми.",
      },
      {
        id: newId("slide"), layout: "bullets", eyebrow: "ВОЗМОЖНОСТИ",
        title: "Ценность появляется там, где программируемость важнее привычного посредника",
        body: "Технология применима не только к оплате: она позволяет задавать правила владения и исполнения операций в коде.",
        bullets: ["Международные переводы", "Токенизация цифровых и реальных прав", "Смарт-контракты и автоматизация расчётов", "Доступ к децентрализованным сервисам"],
        speakerNotes: "Не называйте каждое применение выгодным: полезность зависит от юрисдикции, стоимости и конкретного сценария.",
      },
      {
        id: newId("slide"), layout: "split", eyebrow: "РИСКИ",
        title: "Главные риски связаны не только с ценой, но и с контролем доступа",
        body: "Высокая волатильность заметна первой, однако критичны также ошибки хранения, мошенничество, технические уязвимости и изменение правовых требований.",
        bullets: ["Рыночный риск", "Потеря или компрометация ключей", "Риск контрагента и биржи", "Налоги и регулирование"],
        speakerNotes: "Отделите риск самого протокола от риска сервиса, через который пользователь покупает или хранит актив.",
      },
      {
        id: newId("slide"), layout: "bullets", eyebrow: "ПРОВЕРКА РЕШЕНИЯ",
        title: "До использования нужно ответить на пять практических вопросов",
        body: "Решение должно начинаться со сценария и допустимого риска, а не с выбора популярной монеты.",
        bullets: ["Какую задачу решает актив?", "Кто контролирует приватные ключи?", "Как проверяется контрагент?", "Какие комиссии и ограничения действуют?", "Каковы правовые и налоговые последствия?"],
        speakerNotes: "Эти вопросы превращают обсуждение из эмоционального в управляемое.",
      },
      {
        id: newId("slide"), layout: "closing", eyebrow: "ВЫВОД",
        title: action,
        body: "Выберите один сценарий, проверьте правовые условия и начните с суммы или процесса, потеря которого не создаст критического ущерба.",
        bullets: [], speakerNotes: "Завершите конкретным действием, указанным пользователем, либо предложите отдельную оценку сценария.",
      },
    ];
    return {
      name: "Криптовалюты: возможности и риски",
      description: "Содержательная презентация о принципах работы криптовалют, сценариях применения, рисках и критериях принятия решения.",
      slides: cryptoSlides.slice(0, Math.max(3, input.slideCount - 1)).concat(cryptoSlides.at(-1)!).slice(0, input.slideCount),
    };
  }
  const middle: Array<Pick<PresentationSlide, "layout" | "eyebrow" | "title" | "body" | "bullets">> = [
    { layout: "statement", eyebrow: "ЗАДАЧА", title: "Презентация должна привести аудиторию к одному понятному решению", body: input.goal.slice(0, 700), bullets: [] },
    { layout: "split", eyebrow: "КОНТЕКСТ", title: "Исходная ситуация задаёт границы сильного предложения", body: facts, bullets: ["Что уже известно", "Что остаётся гипотезой", "Что нужно проверить"] },
    { layout: "bullets", eyebrow: "АУДИТОРИЯ", title: `${audience} оценивает не набор функций, а полезность в своей работе`, body: "Свяжите предложение с реальным рабочим сценарием и критерием выбора.", bullets: ["Текущая задача аудитории", "Предлагаемое изменение", "Наблюдаемый результат"] },
    { layout: "statement", eyebrow: "ЦЕННОСТЬ", title: "Сильное предложение объясняет изменение простым рабочим сценарием", body: "Покажите путь от текущей ситуации к результату — без неподтверждённых обещаний.", bullets: [] },
    { layout: "split", eyebrow: "ПИЛОТ", title: "Ограниченный пилот снижает стоимость ошибки", body: "Начните с одного понятного сценария.", bullets: ["Один процесс", "Ограниченная группа", "Заранее выбранный критерий"] },
    { layout: "bullets", eyebrow: "ПРОВЕРКА", title: "Критерии решения нужно согласовать до старта", body: "Так результат можно обсуждать предметно.", bullets: ["Что наблюдаем", "Когда подводим итог", "Кто принимает решение о продолжении"] },
    { layout: "statement", eyebrow: "РИСК", title: "Главный риск — принять удобный процесс за полезный", body: "Оцените не только удобство, но и качество результата для рабочей задачи.", bullets: [] },
    { layout: "split", eyebrow: "РЕШЕНИЕ", title: "Итог пилота должен вести к одному из трёх решений", body: "Продолжить, изменить условия проверки или остановиться.", bullets: ["Масштабировать", "Уточнить гипотезу", "Отказаться без лишних затрат"] },
    { layout: "bullets", eyebrow: "ПОДГОТОВКА", title: "До запуска достаточно ответить на три вопроса", body: "Не усложняйте первый цикл.", bullets: ["Какой сценарий берём", "Кто участвует", "Как фиксируем обратную связь"] },
    { layout: "statement", eyebrow: "ВЫВОД", title: "Следующий шаг — согласовать рамки проверки", body: "После этого презентацию можно дополнить подтверждёнными фактами и визуальными материалами.", bullets: [] },
  ];
  const middleCount = Math.max(1, input.slideCount - 2);
  const selected = Array.from({ length: middleCount }, (_, index) => middle[index % middle.length]);
  const slides: PresentationSlide[] = [
    { id: newId("slide"), layout: "title", eyebrow: "ПРЕЗЕНТАЦИЯ", title: summary, body: input.audience ? `Для: ${input.audience}` : "Структура для обсуждения и решения", bullets: [], speakerNotes: "" },
    ...selected.map((slide) => ({ ...slide, id: newId("slide"), speakerNotes: "", bullets: [...slide.bullets] })),
    { id: newId("slide"), layout: "closing", eyebrow: "СЛЕДУЮЩИЙ ШАГ", title: action, body: "Зафиксируйте формат, участников и критерий следующего решения.", bullets: [], speakerNotes: "" },
  ];
  return {
    name: summary,
    description: "Связная редактируемая структура без выдуманных фактов.",
    slides,
  };
}

export async function presentationAiStatus(request: Request): Promise<PresentationAiResponse> {
  await ensureDatabase(request);
  const selected = provider();
  return { configured: Boolean(selected), ...(selected ? { provider: selected.provider } : {}) };
}

export async function generatePresentationOutline(request: Request, value: unknown): Promise<PresentationAiResponse> {
  await ensureDatabase(request);
  const selected = provider();
  if (!selected) throw new ApiRequestError("Сначала подключите ИИ-провайдера в настройках платформы.", 503);
  const input = parseRequest(value);
  const reservation = await reservePresentationGeneration(request, input);
  if (reservation.replayed) return reservation.replayed;
  try {
    const theme = presentationTheme(input.themeId);
    const instructions = `Ты — редактор и арт-директор деловых презентаций на русском языке. Самостоятельно раскрой тему пользователя: не превращай его поля в слайды и не повторяй формулировки анкеты. К последнему слайду аудитория должна понять вывод и увидеть понятное действие. Построй накопительный сюжет: сильный вход → объяснение темы → механизм или контекст → возможности → ограничения и риски → практические критерии → вывод. Каждый слайд раскрывает один аспект темы и имеет заголовок-вывод. Не делай agenda-слайд и не пиши производственные заглушки вроде «нужно показать ценность», «добавьте факты», «согласуйте пилот», если пользователь не просил именно об этом. Не выдумывай конкретные цифры, даты, отзывы, клиентов или результаты. Разрешено объяснять общеизвестные определения, принципы работы, категории возможностей и рисков, относящиеся к теме. presentationTone: executive — кратко и по делу; persuasive — через проблему, пользу и доказательство; educational — от определения к применению; visual — минимум текста. Сам выбери выразительный layout для каждого слайда: title только первый, closing только последний, statement для одной сильной мысли, split для сравнения или механизма, bullets для системы, quote только для реальной цитаты, stats только при наличии подтверждённых чисел. Не повторяй один layout более двух раз подряд. eyebrow — короткая смысловая метка, speakerNotes — 1–3 предложения для выступающего, а не повтор текста. Тексты должны помещаться: title до 90 знаков, body до 360 знаков, не более 5 коротких bullets. Верни ровно ${input.slideCount} слайдов. Ответ — один JSON-объект с name, description и slides; у каждого слайда обязательны layout, eyebrow, title, body, bullets, speakerNotes. Никаких Markdown и комментариев.`;
    const modelInput = {
      userGoal: input.goal,
      audience: input.audience || "Аудитория указана в задаче пользователя",
      factualContext: input.context || "Дополнительные факты не предоставлены — не выдумывать их",
      desiredAudienceAction: input.desiredAction || "Сформулировать уместный следующий шаг из задачи пользователя",
      presentationTone: input.tone,
      slideCount: input.slideCount,
      selectedTheme: input.themeId,
    };
    const schema = responseSchema(input.slideCount);
    const requestBody = {
      method: "POST",
      headers: { Authorization: `Bearer ${selected.key}`, "Content-Type": "application/json" },
      body: JSON.stringify(selected.provider === "navyai" ? {
        model: selected.model,
        messages: [{ role: "system", content: instructions }, { role: "user", content: JSON.stringify(modelInput) }],
        max_tokens: input.slideCount > 12 ? 4_200 : 3_400,
        response_format: { type: "json_object" },
      } : {
        model: selected.model,
        store: false,
        safety_identifier: await safetyIdentifier(request),
        reasoning: { effort: "low" },
        max_output_tokens: input.slideCount > 12 ? 4_200 : 3_400,
        instructions,
        input: JSON.stringify(modelInput),
        text: { format: { type: "json_schema", name: "presentation_outline", strict: true, schema } },
      }),
    } satisfies RequestInit;
    let { response, body: responseBody } = await callPresentationProvider(selected.endpoint, requestBody);
    if (
      !response.ok
      && response.status !== 429
      && selected.provider === "navyai"
      && selected.fallbackModel
      && selected.model !== selected.fallbackModel
    ) {
      const fallbackBody = { ...JSON.parse(String(requestBody.body)) as Record<string, unknown>, model: selected.fallbackModel };
      ({ response, body: responseBody } = await callPresentationProvider(selected.endpoint, { ...requestBody, body: JSON.stringify(fallbackBody) }));
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
      const raw = JSON.parse(String(requestBody.body)) as Record<string, unknown>;
      const retryInstructions = `${instructions}\nПРЕДЫДУЩАЯ ПОПЫТКА НАРУШИЛА ФОРМАТ. Верни только один валидный JSON-объект без Markdown, вводного текста и комментариев. Проверь количество слайдов и обязательные поля.`;
      const retryBody = selected.provider === "navyai"
        ? {
            ...raw,
            model: selected.fallbackModel || selected.model,
            messages: [
              { role: "system", content: retryInstructions },
              { role: "user", content: JSON.stringify(modelInput) },
            ],
          }
        : { ...raw, reasoning: { effort: "medium" }, instructions: retryInstructions };
      try {
        const retry = await callPresentationProvider(selected.endpoint, {
          ...requestBody,
          body: JSON.stringify(retryBody),
        });
        if (!retry.response.ok) throw providerResponseError(retry.response.status);
        parsed = parseJson(outputText(retry.body));
        slides = parseSlides(parsed.slides, input.slideCount);
      } catch (retryError) {
        if (retryError instanceof ApiRequestError && (retryError.status === 429 || retryError.status === 504)) {
          throw retryError;
        }
        const fallback = safeFallbackOutline(input);
        parsed = { name: fallback.name, description: fallback.description };
        slides = fallback.slides;
        usedTopicFallback = true;
      }
    }
    const result: PresentationAiResponse = {
      configured: true,
      provider: selected.provider,
      generationMode: usedTopicFallback ? "topic_fallback" : "provider",
      ...(usedTopicFallback ? {
        generationNotice: "Ответ ИИ не прошёл проверку структуры, поэтому Поток собрал содержательную редактируемую версию по теме запроса.",
      } : {}),
      outline: {
        name: optionalModelText(parsed.name, "Название презентации", 120) || input.goal.split(/[.!?\n]/)[0]?.slice(0, 120) || "Новая презентация",
        description: optionalModelText(parsed.description, "Описание презентации", 500) ?? "Создано ИИ-помощником Поток.",
        themeId: input.themeId,
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        textColor: theme.textColor,
        slides,
      },
    };
    await finishPresentationGeneration(reservation.key, "completed", result);
    return result;
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 504 || error.status === 502 || error.status === 422)) {
      const theme = presentationTheme(input.themeId);
      const fallback = safeFallbackOutline(input);
      const result: PresentationAiResponse = {
        configured: true,
        provider: selected.provider,
        generationMode: "topic_fallback",
        generationNotice: "ИИ-провайдер не ответил вовремя, поэтому Поток подготовил содержательную редактируемую версию по теме запроса.",
        outline: {
          ...fallback,
          themeId: input.themeId,
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

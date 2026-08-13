import { env } from "cloudflare:workers";

import { getD1 } from "@/db";

import type {
  ImageStudioAspect,
  ImageStudioGenerateRequest,
  ImageStudioGenerateResponse,
  ImageStudioStatusResponse,
  ImageStudioStyle,
} from "@/types/api";

import { ApiRequestError, asObject, cleanText, optionalText } from "./api-utils";
import {
  getEmailAssetRecord,
  listEmailAssets,
  storeGeneratedEmailAsset,
  storeGeneratedEmailAssetBytes,
} from "./email-asset-store";
import { ensureDatabase, WORKSPACE_ID } from "./database-init";

const STYLES = new Set<ImageStudioStyle>([
  "editorial",
  "minimal",
  "photo",
  "abstract",
  "collage",
  "three-dimensional",
]);
const ASPECTS = new Set<ImageStudioAspect>(["square", "landscape", "portrait", "banner"]);
const GENERATION_WINDOW_MS = 10 * 60 * 1_000;
const GENERATION_LIMIT = 6;
const MAX_BASE64_LENGTH = 14_000_000;

const styleDirections: Record<ImageStudioStyle, string> = {
  editorial: "Редакционная арт-дирекция, смелая типографическая композиция без читаемого текста, уверенная сетка, много воздуха.",
  minimal: "Минимализм, чистые формы, один визуальный акцент, точные отступы, спокойный фон.",
  photo: "Правдоподобная премиальная фотография, естественный свет, живые фактуры, без стоковых клише.",
  abstract: "Современная абстракция, выразительные цветовые плоскости, мягкие градиенты и геометрический ритм.",
  collage: "Авторский коллаж, слои бумаги, вырезки, тонкие контуры и тактильные тени, сбалансированная композиция.",
  "three-dimensional": "Качественная 3D-иллюстрация, матовые материалы, мягкое студийное освещение, точная геометрия.",
};

const aspectSizes: Record<ImageStudioAspect, string> = {
  square: "1024x1024",
  landscape: "1536x1024",
  portrait: "1024x1536",
  banner: "1536x1024",
};

function runtime() {
  return env as unknown as {
    NAVYAI_API_KEY?: string;
    NAVYAI_BASE_URL?: string;
    NAVYAI_IMAGE_MODEL?: string;
  };
}

function provider() {
  const key = runtime().NAVYAI_API_KEY?.trim();
  if (!key) return null;
  const baseUrl = runtime().NAVYAI_BASE_URL?.trim().replace(/\/$/, "") || "https://api.navy/v1";
  return {
    key,
    endpoint: `${baseUrl}/images/generations`,
    model: runtime().NAVYAI_IMAGE_MODEL?.trim() || "gpt-image-1.5",
  };
}

export function buildImageGenerationPrompt(input: ImageStudioGenerateRequest) {
  const bannerDirection = input.aspect === "banner"
    ? "Широкая горизонтальная композиция для шапки: главный объект в центральных 60%, края можно безопасно обрезать."
    : "Композиция должна целиком работать в выбранном формате без случайного кадрирования.";
  return [
    input.prompt,
    styleDirections[input.style],
    bannerDirection,
    input.aspect === "portrait" ? "Если изображение предназначено для фона, сохрани спокойную периферию и достаточное негативное пространство для текста поверх." : "",
    "Создай законченное оригинальное изображение без водяных знаков, UI-мокапа и нечитаемого псевдотекста. Не добавляй логотип, если он не описан в задаче.",
  ].join("\n\n");
}

function parseRequest(value: unknown): ImageStudioGenerateRequest {
  const object = asObject(value);
  const prompt = cleanText(object.prompt, "Описание изображения", 1_600);
  if (prompt.length < 12) throw new ApiRequestError("Опишите изображение хотя бы в одном предложении.");
  const style = cleanText(object.style, "Стиль", 40) as ImageStudioStyle;
  if (!STYLES.has(style)) throw new ApiRequestError("Выберите стиль из списка.");
  const aspect = cleanText(object.aspect, "Формат", 30) as ImageStudioAspect;
  if (!ASPECTS.has(aspect)) throw new ApiRequestError("Выберите формат изображения.");
  const quality = object.quality === "high" ? "high" : object.quality === "standard" ? "standard" : null;
  if (!quality) throw new ApiRequestError("Выберите качество изображения.");
  const referenceAssetId = optionalText(object.referenceAssetId, "Референс", 160);
  if (referenceAssetId) {
    throw new ApiRequestError(
      "Текущий NavyAI API не поддерживает image-to-image. Уберите референс или опишите его в промпте.",
      422,
    );
  }
  return { prompt, style, aspect, quality, title: optionalText(object.title, "Название", 120) };
}

function decodeBase64(value: string) {
  if (value.length > MAX_BASE64_LENGTH) {
    throw new ApiRequestError("NavyAI вернул слишком большое изображение.", 502);
  }
  const binary = atob(value.replace(/^data:image\/\w+;base64,/, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
  asset_id: string | null;
};

async function existingIdempotentResult(request: Request, key: string, requestHash: string) {
  const row = await getD1()
    .prepare("SELECT request_hash, status, asset_id FROM ai_idempotency WHERE key = ?")
    .bind(key)
    .first<IdempotencyRow>();
  if (!row) return null;
  if (row.request_hash !== requestHash) {
    throw new ApiRequestError("Этот Idempotency-Key уже использован для другого запроса.", 409);
  }
  if (row.status === "completed" && row.asset_id) {
    return getEmailAssetRecord(request, row.asset_id);
  }
  if (row.status === "pending") {
    throw new ApiRequestError("Этот запрос уже выполняется. Дождитесь результата перед повтором.", 409);
  }
  throw new ApiRequestError("Предыдущая попытка с этим ключом завершилась ошибкой. Повторите с новым Idempotency-Key.", 409);
}

async function reserveGeneration(request: Request, input: ImageStudioGenerateRequest) {
  const rawKey = idempotencyHeader(request);
  const actor = request.headers.get("oai-authenticated-user-id")?.trim() || "mailflow-local-participant";
  const [actorHash, requestHash] = await Promise.all([
    digest(actor),
    digest(JSON.stringify(input)),
  ]);
  const key = await digest(`${WORKSPACE_ID}:image-studio:${actorHash}:${rawKey}`);
  const replayed = await existingIdempotentResult(request, key, requestHash);
  if (replayed) return { key, requestHash, replayed };

  const now = new Date();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - GENERATION_WINDOW_MS).toISOString();
  const rateKey = `${WORKSPACE_ID}:image-studio:${actorHash}`;
  const rate = await getD1().prepare(`
    INSERT INTO ai_request_limits (key, workspace_id, scope, window_started_at, request_count, updated_at)
    VALUES (?, ?, 'image-studio', ?, 1, ?)
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
    throw new ApiRequestError(
      "Слишком много генераций за короткое время. Повторите через несколько минут.",
      429,
      [`Лимит: ${GENERATION_LIMIT} изображений за 10 минут.`],
    );
  }

  const inserted = await getD1().prepare(`
    INSERT OR IGNORE INTO ai_idempotency
      (key, workspace_id, operation, request_hash, status, asset_id, created_at, updated_at)
    VALUES (?, ?, 'image-studio', ?, 'pending', NULL, ?, ?)
  `).bind(key, WORKSPACE_ID, requestHash, nowIso, nowIso).run();
  if ((inserted.meta.changes ?? 0) === 0) {
    const concurrent = await existingIdempotentResult(request, key, requestHash);
    if (concurrent) return { key, requestHash, replayed: concurrent };
  }
  void getD1().prepare("DELETE FROM ai_idempotency WHERE updated_at < ?")
    .bind(new Date(now.getTime() - 48 * 60 * 60 * 1_000).toISOString())
    .run()
    .catch(() => undefined);
  return { key, requestHash, replayed: null };
}

function providerError(value: unknown) {
  try {
    const object = asObject(value);
    if (!object.error || typeof object.error !== "object" || Array.isArray(object.error)) return undefined;
    const message = (object.error as Record<string, unknown>).message;
    return typeof message === "string" ? message.slice(0, 300) : undefined;
  } catch {
    return undefined;
  }
}

async function callProvider(
  active: NonNullable<ReturnType<typeof provider>>,
  input: ImageStudioGenerateRequest,
  prompt: string,
) {
  let response: Response;
  try {
    response = await fetch(active.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${active.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: active.model,
        prompt,
        size: aspectSizes[input.aspect],
        quality: input.quality,
        n: 1,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ApiRequestError(
      timedOut
        ? "NavyAI не ответил за две минуты. Галерея не изменена."
        : "Не удалось связаться с NavyAI. Галерея не изменена.",
      timedOut ? 504 : 502,
    );
  }
  const raw = await response.text();
  let body: unknown = {};
  try { body = JSON.parse(raw); } catch { /* A provider gateway can return plain text. */ }
  if (!response.ok) {
    throw new ApiRequestError(
      "NavyAI не создал изображение. Исходные данные и галерея не изменены.",
      response.status >= 500 ? 502 : 422,
      providerError(body) ? [providerError(body)!] : undefined,
    );
  }
  return asObject(body);
}

export async function imageStudioStatus(request: Request): Promise<ImageStudioStatusResponse> {
  const active = provider();
  const { assets } = await listEmailAssets(request);
  return {
    configured: Boolean(active),
    provider: active ? "navyai" : null,
    model: active?.model ?? null,
    referenceImageSupported: false,
    assets: assets.filter((asset) => asset.kind === "photo"),
  };
}

export async function generateStudioImage(request: Request, value: unknown): Promise<ImageStudioGenerateResponse> {
  await ensureDatabase(request);
  const active = provider();
  if (!active) {
    throw new ApiRequestError("Генерация не подключена: добавьте серверный NAVYAI_API_KEY.", 503);
  }
  const input = parseRequest(value);
  const reservation = await reserveGeneration(request, input);
  if (reservation.replayed) {
    return { asset: reservation.replayed, revisedPrompt: buildImageGenerationPrompt(input) };
  }
  const revisedPrompt = buildImageGenerationPrompt(input);
  try {
    const result = await callProvider(active, input, revisedPrompt);
    const data = Array.isArray(result.data) ? result.data : [];
    const first = data[0] && typeof data[0] === "object" && !Array.isArray(data[0])
      ? data[0] as Record<string, unknown>
      : null;
    if (!first) throw new ApiRequestError("NavyAI вернул пустой результат. Повторите запрос.", 502);

    const cleanTitle = (input.title?.trim() || input.prompt.split(/[.!?\n]/)[0] || "Изображение").slice(0, 90);
    const filename = `ИИ · ${cleanTitle}.png`;
    const asset = typeof first.url === "string" && first.url.startsWith("https://")
      ? await storeGeneratedEmailAsset(request, first.url, "photo", filename)
      : typeof first.b64_json === "string" && first.b64_json.length > 100
        ? await storeGeneratedEmailAssetBytes(request, decodeBase64(first.b64_json), "image/png", "photo", filename)
        : null;
    if (!asset) throw new ApiRequestError("NavyAI не вернул файл изображения. Галерея не изменена.", 502);
    await getD1().prepare("UPDATE ai_idempotency SET status = 'completed', asset_id = ?, updated_at = ? WHERE key = ?")
      .bind(asset.id, new Date().toISOString(), reservation.key)
      .run();
    return { asset, revisedPrompt };
  } catch (error) {
    await getD1().prepare("UPDATE ai_idempotency SET status = 'failed', updated_at = ? WHERE key = ?")
      .bind(new Date().toISOString(), reservation.key)
      .run()
      .catch(() => undefined);
    throw error;
  }
}

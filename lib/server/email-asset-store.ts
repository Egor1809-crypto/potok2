import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { emailAssets } from "@/db/schema";
import type {
  EmailAssetMutationResponse,
  EmailAssetRecord,
  EmailAssetsListResponse,
} from "@/types/api";

import { ApiRequestError, cleanText, newId } from "./api-utils";
import { ensureDatabase, WORKSPACE_ID } from "./database-init";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_GENERATED_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"] as const);
type AllowedMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function bucket(): R2Bucket {
  if (!env.MEDIA) {
    throw new ApiRequestError(
      "Хранилище изображений временно недоступно.",
      503,
    );
  }
  return env.MEDIA;
}

function assetUrl(request: Request, id: string) {
  return new URL(`/api/assets/${encodeURIComponent(id)}`, request.url).toString();
}

function toRecord(request: Request, row: typeof emailAssets.$inferSelect): EmailAssetRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    kind: row.kind,
    url: assetUrl(request, row.id),
    createdAt: row.createdAt,
  };
}

function validSignature(bytes: Uint8Array, mime: AllowedMime) {
  if (mime === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  }
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/webp") return bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return bytes.length >= 6 && new TextDecoder().decode(bytes.slice(0, 6)).startsWith("GIF8");
}

async function persistEmailAsset(request: Request, bytes: Uint8Array, mimeType: AllowedMime, filename: string, kind: "photo" | "logo") {
  const id = newId("asset");
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/gif" ? "gif" : mimeType === "image/webp" ? "webp" : "jpg";
  const objectKey = `${WORKSPACE_ID}/email/${id}.${extension}`;
  const now = new Date().toISOString();
  await bucket().put(objectKey, bytes, {
    httpMetadata: { contentType: mimeType, cacheControl: "public, max-age=31536000, immutable" },
    customMetadata: { workspaceId: WORKSPACE_ID, originalFilename: filename, kind },
  });
  try {
    await getDb().insert(emailAssets).values({ id, workspaceId: WORKSPACE_ID, objectKey, filename, mimeType, size: bytes.byteLength, kind, createdAt: now });
  } catch (error) {
    await bucket().delete(objectKey);
    throw error;
  }
  const [row] = await getDb().select().from(emailAssets).where(eq(emailAssets.id, id)).limit(1);
  return toRecord(request, row);
}

export async function listEmailAssets(request: Request): Promise<EmailAssetsListResponse> {
  await ensureDatabase(request);
  const rows = await getDb()
    .select()
    .from(emailAssets)
    .where(eq(emailAssets.workspaceId, WORKSPACE_ID))
    .orderBy(desc(emailAssets.createdAt))
    .limit(80);
  return { assets: rows.map((row) => toRecord(request, row)) };
}

export async function getEmailAssetRecord(request: Request, idValue: unknown): Promise<EmailAssetRecord> {
  const id = cleanText(idValue, "Изображение", 160);
  const [row] = await getDb()
    .select()
    .from(emailAssets)
    .where(and(eq(emailAssets.id, id), eq(emailAssets.workspaceId, WORKSPACE_ID)))
    .limit(1);
  if (!row) throw new ApiRequestError("Изображение не найдено.", 404);
  return toRecord(request, row);
}

export async function uploadEmailAsset(request: Request): Promise<EmailAssetMutationResponse> {
  await ensureDatabase(request);
  const form = await request.formData();
  const file = form.get("file");
  const kindValue = form.get("kind");
  const kind = kindValue === "logo" ? "logo" : kindValue === "photo" ? "photo" : null;
  if (!(file instanceof File)) throw new ApiRequestError("Выберите файл изображения.");
  if (!kind) throw new ApiRequestError("Укажите назначение изображения: фото или логотип.");
  if (!ALLOWED_TYPES.has(file.type as AllowedMime)) {
    throw new ApiRequestError("Поддерживаются изображения PNG, JPEG и GIF.");
  }
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) {
    throw new ApiRequestError("Размер изображения должен быть не больше 4 МБ.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validSignature(bytes, file.type as AllowedMime)) {
    throw new ApiRequestError("Содержимое файла не соответствует формату изображения.");
  }
  const filename = cleanText(file.name || "image", "Название файла", 180) || "image";
  return { asset: await persistEmailAsset(request, bytes, file.type as AllowedMime, filename, kind) };
}

export async function storeGeneratedEmailAsset(request: Request, sourceUrl: string, kind: "photo" | "logo", filename: string) {
  await ensureDatabase(request);
  const source = new URL(sourceUrl);
  if (source.protocol !== "https:") throw new ApiRequestError("ИИ вернул небезопасную ссылку изображения.", 502);
  const response = await fetch(source, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" } });
  if (!response.ok) throw new ApiRequestError("Сгенерированное изображение не удалось загрузить в платформу.", 502);
  const mimeType = (response.headers.get("content-type")?.split(";")[0]?.trim() ?? "") as AllowedMime;
  if (!ALLOWED_TYPES.has(mimeType)) throw new ApiRequestError("ИИ вернул неподдерживаемый формат изображения.", 502);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_GENERATED_IMAGE_BYTES) throw new ApiRequestError("Сгенерированное изображение превышает 10 МБ.", 502);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_GENERATED_IMAGE_BYTES || !validSignature(bytes, mimeType)) throw new ApiRequestError("ИИ вернул повреждённое изображение.", 502);
  return persistEmailAsset(request, bytes, mimeType, cleanText(filename, "Название изображения", 180), kind);
}

export async function storeGeneratedEmailAssetBytes(
  request: Request,
  bytes: Uint8Array,
  mimeType: AllowedMime,
  kind: "photo" | "logo",
  filename: string,
) {
  await ensureDatabase(request);
  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new ApiRequestError("ИИ вернул неподдерживаемый формат изображения.", 502);
  }
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_GENERATED_IMAGE_BYTES || !validSignature(bytes, mimeType)) {
    throw new ApiRequestError("ИИ вернул повреждённое или слишком большое изображение.", 502);
  }
  return persistEmailAsset(
    request,
    bytes,
    mimeType,
    cleanText(filename, "Название изображения", 180),
    kind,
  );
}

export async function getEmailAsset(request: Request, idValue: unknown): Promise<Response> {
  const id = cleanText(idValue, "Изображение", 160);
  const [row] = await getDb()
    .select()
    .from(emailAssets)
    .where(and(eq(emailAssets.id, id), eq(emailAssets.workspaceId, WORKSPACE_ID)))
    .limit(1);
  if (!row) throw new ApiRequestError("Изображение не найдено.", 404);
  const object = await bucket().get(row.objectKey);
  if (!object) throw new ApiRequestError("Файл изображения не найден в хранилище.", 404);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Content-Type": row.mimeType,
    "Content-Length": String(row.size),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`;
  }
  return new Response(object.body, {
    headers,
  });
}

export async function deleteEmailAsset(request: Request, idValue: unknown) {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Изображение", 160);
  const [row] = await getDb()
    .select()
    .from(emailAssets)
    .where(and(eq(emailAssets.id, id), eq(emailAssets.workspaceId, WORKSPACE_ID)))
    .limit(1);
  if (!row) throw new ApiRequestError("Изображение не найдено.", 404);
  await bucket().delete(row.objectKey);
  await getDb().delete(emailAssets).where(and(eq(emailAssets.id, id), eq(emailAssets.workspaceId, WORKSPACE_ID)));
  return { deletedId: id };
}

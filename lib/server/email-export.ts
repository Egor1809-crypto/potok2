import { env } from "cloudflare:workers";

import type { EmailBuilderDocumentInput } from "@/types/api";

import { ApiRequestError } from "./api-utils";
import { getEmailAssetDataUrl } from "./email-asset-store";
import { compileEmailDocument } from "./email-document";

const PRODUCTION_ORIGIN = "https://mailflow-outreach.isakovegor820.chatgpt.site";
const MAX_PORTABLE_IMAGE_BYTES = 10 * 1024 * 1024;

function htmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function assetId(source: string) {
  try {
    const pathname = new URL(source).pathname;
    const match = pathname.match(/^\/api\/assets\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function imageSources(document: EmailBuilderDocumentInput) {
  const sources = new Set<string>();
  if (document.backgroundImageUrl) sources.add(document.backgroundImageUrl);
  for (const block of document.blocks) {
    if ((block.type === "image" || block.type === "logo") && block.href) {
      sources.add(block.href);
    }
  }
  return [...sources];
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function hostedImageDataUrl(request: Request, source: string) {
  const sourceUrl = new URL(source);
  const requestOrigin = new URL(request.url).origin;
  if (sourceUrl.origin !== requestOrigin && sourceUrl.origin !== PRODUCTION_ORIGIN) {
    throw new ApiRequestError(
      "В письме есть внешняя картинка, которую нельзя встроить в автономный файл. Загрузите её в медиатеку «Потока» и повторите экспорт.",
      422,
    );
  }
  const assetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, requestOrigin);
  const assetHeaders = { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml" };
  const assetRequest = new Request(assetUrl, {
    headers: assetHeaders,
  });
  const assets = env.ASSETS as Fetcher | undefined;
  let response: Response;
  try {
    response = assets
      ? await assets.fetch(new Request(new URL(`${sourceUrl.pathname}${sourceUrl.search}`, "https://assets.local"), { headers: assetHeaders }))
      : await fetch(assetRequest, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  } catch {
    response = await fetch(assetRequest, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
  }
  if (!response.ok) {
    throw new ApiRequestError("Одно из изображений письма временно недоступно.", 502);
  }
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!mimeType.startsWith("image/")) {
    throw new ApiRequestError("Адрес изображения вернул файл другого типа.", 502);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_PORTABLE_IMAGE_BYTES) {
    throw new ApiRequestError("Изображение нельзя встроить в файл: оно пустое или больше 10 МБ.", 413);
  }
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

async function imageDataUrl(request: Request, source: string) {
  try {
    const id = assetId(source);
    return id
      ? await getEmailAssetDataUrl(request, id)
      : await hostedImageDataUrl(request, source);
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new ApiRequestError(`Не удалось встроить изображение в файл: ${detail}`, 502);
  }
}

export async function compilePortableEmailDocument(
  request: Request,
  document: EmailBuilderDocumentInput,
) {
  let html = compileEmailDocument(document);
  const replacements = await Promise.all(
    imageSources(document).map(async (source) => ({
      source,
      dataUrl: await imageDataUrl(request, source),
    })),
  );
  for (const { source, dataUrl } of replacements) {
    html = html.replaceAll(source, dataUrl).replaceAll(htmlAttribute(source), dataUrl);
  }
  return html;
}

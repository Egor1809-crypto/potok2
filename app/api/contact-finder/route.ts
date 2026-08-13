import { ApiRequestError, jsonError } from "@/lib/server/api-utils";
import { ensureDatabase } from "@/lib/server/database-init";
import { findPublicContacts } from "@/lib/server/contact-finder";

export const dynamic = "force-dynamic";
const MAX_REQUEST_BYTES = 420_000;

async function readLimitedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw new ApiRequestError("Запрос анализа слишком большой.", 413);
  }
  if (!request.body) throw new ApiRequestError("Не удалось прочитать данные запроса.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new ApiRequestError("Запрос анализа слишком большой.", 413);
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
    throw new ApiRequestError("Не удалось прочитать данные запроса.");
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase(request);
    const payload = await readLimitedJson(request);
    return Response.json(await findPublicContacts(payload, request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

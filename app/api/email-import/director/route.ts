import { ApiRequestError, jsonError } from "@/lib/server/api-utils";
import { directImportedEmail } from "@/lib/server/imported-email-director";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (!request.body || Number(request.headers.get("content-length")) > 2_100_000) throw new ApiRequestError("Письмо слишком большое или отсутствует.", 413);
    const reader = request.body.getReader(), chunks: Uint8Array[] = [];
    let length = 0;
    while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 2_100_000) { await reader.cancel(); throw new ApiRequestError("Письмо слишком большое для разбора.", 413); } chunks.push(part.value); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiRequestError("Не удалось прочитать письмо."); }
    return Response.json(await directImportedEmail(request, value), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

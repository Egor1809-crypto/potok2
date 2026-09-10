import { ApiRequestError, jsonError } from "@/lib/server/api-utils";
import { convertEmailCode } from "@/lib/server/email-code-import";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!request.body || Number(request.headers.get("content-length")) > 250_000) throw new ApiRequestError("Код слишком большой или отсутствует.", 413);
    const reader = request.body.getReader(), chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 250_000) { await reader.cancel(); throw new ApiRequestError("Вставьте фрагмент до 60 000 символов.", 413); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let input: unknown;
    try { input = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new ApiRequestError("Не удалось прочитать исходный код.", 400); }
    return Response.json(await convertEmailCode(request, input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

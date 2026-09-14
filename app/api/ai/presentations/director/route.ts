import { jsonError, ApiRequestError } from "@/lib/server/api-utils";
import { directPresentation } from "@/lib/server/presentation-director";
export async function POST(request: Request) {
  try {
    const reader = request.body?.getReader(); if (!reader) throw new ApiRequestError("Передайте слайд.");
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 9_000_000) { await reader.cancel(); throw new ApiRequestError("Слайд слишком большой для разбора.", 413); } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body: unknown; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiRequestError("Не удалось прочитать слайд."); }
    return Response.json(await directPresentation(request, body));
  } catch (error) { return jsonError(error); }
}

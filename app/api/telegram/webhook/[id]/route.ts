import { jsonError } from "@/lib/server/api-utils";
import { receiveTelegramUpdate } from "@/lib/server/telegram-webhook";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return Response.json(await receiveTelegramUpdate(request, (await context.params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return jsonError(error); }
}

import { jsonError } from "@/lib/server/api-utils";
import { ensureDatabase } from "@/lib/server/database-init";
import { manageTelegramConnection, telegramConnectionInfo } from "@/lib/server/telegram-connection";
import { readTelegramBody } from "@/lib/server/telegram-webhook";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return Response.json(await telegramConnectionInfo(request), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    await ensureDatabase(request);
    return Response.json(await manageTelegramConnection(request, await readTelegramBody(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

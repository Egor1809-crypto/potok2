import { jsonError } from "@/lib/server/api-utils";
import { getUniSenderLifetimeStats } from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { mode?: unknown; cursor?: unknown };
    const mode = body.mode === "full" ? "full" : "quick";
    const cursor = typeof body.cursor === "number" && Number.isFinite(body.cursor)
      ? Math.max(0, Math.floor(body.cursor))
      : 0;
    return Response.json(await getUniSenderLifetimeStats(request, { mode, cursor }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

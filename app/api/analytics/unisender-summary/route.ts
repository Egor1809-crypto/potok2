import { jsonError } from "@/lib/server/api-utils";
import { getUniSenderLifetimeStats } from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return Response.json(await getUniSenderLifetimeStats(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

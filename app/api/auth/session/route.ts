import { jsonError } from "@/lib/server/api-utils";
import { ensureSystemDatabase } from "@/lib/server/database-init";
import { getTeamSession } from "@/lib/server/team-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureSystemDatabase();
    const session = await getTeamSession(request);
    return Response.json({ participant: session?.participant ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

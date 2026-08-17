import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import { ensureSystemDatabase } from "@/lib/server/database-init";
import { changeTeamPassword } from "@/lib/server/team-auth";

export async function POST(request: Request) {
  try {
    await ensureSystemDatabase();
    return Response.json(await changeTeamPassword(request, await readJsonBody(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

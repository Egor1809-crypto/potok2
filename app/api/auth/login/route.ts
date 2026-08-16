import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import { ensureSystemDatabase } from "@/lib/server/database-init";
import { loginTeamMember } from "@/lib/server/team-auth";

export async function POST(request: Request) {
  try {
    await ensureSystemDatabase();
    const result = await loginTeamMember(request, await readJsonBody(request));
    return Response.json(
      { participant: result.participant },
      { headers: { "Set-Cookie": result.cookie, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

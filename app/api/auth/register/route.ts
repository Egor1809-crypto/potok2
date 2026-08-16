import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import { ensureSystemDatabase } from "@/lib/server/database-init";
import { registerTeamMember } from "@/lib/server/team-auth";

export async function POST(request: Request) {
  try {
    await ensureSystemDatabase();
    const result = await registerTeamMember(request, await readJsonBody(request));
    return Response.json(
      { participant: result.participant, firstAccount: result.firstAccount },
      { status: 201, headers: { "Set-Cookie": result.cookie, "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

import { jsonError } from "@/lib/server/api-utils";
import { ensureSystemDatabase } from "@/lib/server/database-init";
import { logoutTeamMember } from "@/lib/server/team-auth";

export async function POST(request: Request) {
  try {
    await ensureSystemDatabase();
    const result = await logoutTeamMember(request);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": result.cookie, "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

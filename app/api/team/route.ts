import { jsonError } from "@/lib/server/api-utils";
import { ensureDatabase } from "@/lib/server/database-init";
import { createTeamInvite, listTeamMembers, TEAM_NAME } from "@/lib/server/team-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await ensureDatabase(request);
    return Response.json({ teamName: TEAM_NAME, participant: actor.participant, members: await listTeamMembers() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await ensureDatabase(request);
    return Response.json(await createTeamInvite(actor.participant.id), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

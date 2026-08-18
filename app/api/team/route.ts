import { jsonError } from "@/lib/server/api-utils";
import { ensureDatabase, rebalanceContactsForChannelMask } from "@/lib/server/database-init";
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
    const payload = await request.clone().json().catch(() => null) as { action?: unknown; mask?: unknown } | null;
    if (payload?.action === "rebalance_contacts") {
      return Response.json(await rebalanceContactsForChannelMask(Number(payload.mask)));
    }
    return Response.json(await createTeamInvite(actor.participant.id), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

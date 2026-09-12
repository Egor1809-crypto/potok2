import { ApiRequestError, jsonError, readJsonBody } from "@/lib/server/api-utils";
import { teamOverview, manageTeam } from "@/lib/server/team-management";
import { ensureDatabase, rebalanceContactsForChannelMask } from "@/lib/server/database-init";
import { requireTeamAdmin } from "@/lib/server/team-access";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return Response.json(await teamOverview(request), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return jsonError(error); }
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new ApiRequestError("Нельзя изменить команду с другого сайта.",403);
    const payload = await readJsonBody(request);
    if (payload && typeof payload === "object" && "action" in payload && payload.action === "rebalance_contacts") {
      requireTeamAdmin((await ensureDatabase(request)).participant);
      return Response.json(await rebalanceContactsForChannelMask(Number((payload as { mask?: unknown }).mask)));
    }
    return Response.json(await manageTeam(request,payload), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

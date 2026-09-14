import { getD1 } from "@/db";
import { jsonError } from "@/lib/server/api-utils";
import { ensureSystemDatabase } from "@/lib/server/database-init";
import { requireTeamSession } from "@/lib/server/team-auth";
import { yandexClientId } from "@/lib/server/yandex-auth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await ensureSystemDatabase();
    const session = await requireTeamSession(request);
    const identity = await getD1().prepare("SELECT 1 AS linked FROM oauth_identities WHERE provider='yandex' AND participant_id=?").bind(session.participant.id).first();
    return Response.json({configured:Boolean(yandexClientId()),linked:Boolean(identity)},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return jsonError(error); }
}

import { jsonError } from "@/lib/server/api-utils";
import { ensureSystemDatabase } from "@/lib/server/database-init";
import { getRegistrationStatus } from "@/lib/server/team-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSystemDatabase();
    return Response.json(await getRegistrationStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

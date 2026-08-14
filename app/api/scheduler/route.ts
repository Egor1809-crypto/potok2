import { runDueScheduledCampaigns } from "@/lib/server/mailflow-store";
import { jsonError } from "@/lib/server/api-utils";

export async function POST(request: Request) {
  try {
    return Response.json(await runDueScheduledCampaigns(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

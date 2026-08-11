import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import {
  listIntegrations,
  updateIntegration,
} from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await listIntegrations(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonBody(request);
    return Response.json(await updateIntegration(request, payload));
  } catch (error) {
    return jsonError(error);
  }
}

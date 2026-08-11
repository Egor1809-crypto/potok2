import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  updateCampaign,
} from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await listCampaigns(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody(request);
    return Response.json(await createCampaign(request, payload), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonBody(request);
    return Response.json(await updateCampaign(request, payload));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get("id");
    const payload = queryId
      ? { id: queryId }
      : ((await readJsonBody(request)) as { id?: unknown });
    return Response.json(await deleteCampaign(request, payload.id));
  } catch (error) {
    return jsonError(error);
  }
}

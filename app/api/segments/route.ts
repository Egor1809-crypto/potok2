import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import {
  createSegment,
  deleteSegment,
  listSegments,
  updateSegment,
} from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await listSegments(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody(request);
    return Response.json(await createSegment(request, payload), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonBody(request);
    return Response.json(await updateSegment(request, payload));
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
    return Response.json(await deleteSegment(request, payload.id));
  } catch (error) {
    return jsonError(error);
  }
}

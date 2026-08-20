import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import {
  getWorkspaceBootstrap,
  getWorkspaceSnapshot,
  updateWorkspace,
} from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope");
    return Response.json(scope ? await getWorkspaceBootstrap(request) : await getWorkspaceSnapshot(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonBody(request);
    return Response.json(await updateWorkspace(request, payload));
  } catch (error) {
    return jsonError(error);
  }
}

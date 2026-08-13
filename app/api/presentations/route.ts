import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import {
  createPresentationProject,
  deletePresentationProject,
  getPresentationProject,
  listPresentationProjects,
  updatePresentationProject,
} from "@/lib/server/presentation-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const response = id
      ? await getPresentationProject(request, id)
      : await listPresentationProjects(request);
    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(
      await createPresentationProject(request, await readJsonBody(request)),
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return Response.json(
      await updatePresentationProject(request, await readJsonBody(request)),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const payload = id ? { id } : await readJsonBody(request);
    const idValue = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { id?: unknown }).id
      : undefined;
    return Response.json(await deletePresentationProject(request, idValue));
  } catch (error) {
    return jsonError(error);
  }
}

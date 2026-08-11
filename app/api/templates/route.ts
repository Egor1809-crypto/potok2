import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import {
  cloneEmailTemplate,
  createEmailTemplate,
  deleteEmailTemplate,
  getEmailTemplate,
  listEmailTemplates,
  updateEmailTemplate,
} from "@/lib/server/template-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    const response = id
      ? await getEmailTemplate(request, id)
      : await listEmailTemplates(request);
    return Response.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody(request);
    const isClone =
      Boolean(payload) &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload as { action?: unknown }).action === "clone";
    const response = isClone
      ? await cloneEmailTemplate(request, payload)
      : await createEmailTemplate(request, payload);
    return Response.json(response, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonBody(request);
    return Response.json(await updateEmailTemplate(request, payload));
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
    return Response.json(await deleteEmailTemplate(request, payload.id));
  } catch (error) {
    return jsonError(error);
  }
}

import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import {
  createContact,
  createContactsBatch,
  deleteContact,
  listContactEndpoints,
  listContacts,
  updateContact,
  updateContactsBatch,
} from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const scope = new URL(request.url).searchParams.get("scope");
    return Response.json(scope === "endpoints" ? await listContactEndpoints(request) : await listContacts(request), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonBody(request);
    const isBatch =
      Boolean(payload) &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      Array.isArray((payload as { contacts?: unknown }).contacts);
    const response = isBatch
      ? await createContactsBatch(request, payload)
      : await createContact(request, payload);
    return Response.json(response, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await readJsonBody(request);
    const isBatch = Boolean(payload) && typeof payload === "object" && !Array.isArray(payload) && (
      Array.isArray((payload as { ids?: unknown }).ids) ||
      Boolean((payload as { selection?: unknown }).selection)
    );
    return Response.json(isBatch ? await updateContactsBatch(request, payload) : await updateContact(request, payload));
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
    return Response.json(await deleteContact(request, payload.id));
  } catch (error) {
    return jsonError(error);
  }
}

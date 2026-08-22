import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import { setPresentationFavorite } from "@/lib/server/presentation-store";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    return Response.json(
      await setPresentationFavorite(request, await readJsonBody(request)),
    );
  } catch (error) {
    return jsonError(error);
  }
}

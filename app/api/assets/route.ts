import { jsonError } from "@/lib/server/api-utils";
import { deleteEmailAsset, listEmailAssets, uploadEmailAsset } from "@/lib/server/email-asset-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(await listEmailAssets(request), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    return Response.json(await uploadEmailAsset(request), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return Response.json(await deleteEmailAsset(request, new URL(request.url).searchParams.get("id")));
  } catch (error) {
    return jsonError(error);
  }
}

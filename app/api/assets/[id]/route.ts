import { jsonError } from "@/lib/server/api-utils";
import { getEmailAsset } from "@/lib/server/email-asset-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return await getEmailAsset(request, id);
  } catch (error) {
    return jsonError(error);
  }
}

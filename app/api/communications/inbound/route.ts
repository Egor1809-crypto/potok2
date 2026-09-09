import { jsonError } from "@/lib/server/api-utils";
import { ingestWebhook } from "@/lib/server/communication-store";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { try {
    return Response.json(await ingestWebhook(request));
}
catch (error) {
    return jsonError(error);
} }

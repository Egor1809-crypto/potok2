import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import { communicationOverview, mutateCommunications } from "@/lib/server/communication-store";
import { checkCommunicationAudience } from "@/lib/server/mailflow-store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    try {
        const result = await communicationOverview(request);
        return Response.json(result, { headers: { "Cache-Control": "no-store", ...("export" in result ? { "Content-Disposition": 'attachment; filename="consent-evidence.json"' } : {}) } });
    }
    catch (error) {
        return jsonError(error);
    }
}
export async function POST(request: Request) {
    try {
        const payload = await readJsonBody(request);
        return Response.json(payload && typeof payload === "object" && "action" in payload && payload.action === "check" ? await checkCommunicationAudience(request, payload) : await mutateCommunications(request, payload), { headers: { "Cache-Control": "no-store" } });
    }
    catch (error) {
        return jsonError(error);
    }
}

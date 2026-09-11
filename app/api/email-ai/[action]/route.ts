import { emailAiStudio } from "@/lib/server/email-ai-studio";
import { jsonError, readJsonBody } from "@/lib/server/api-utils";

export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await context.params;
    return Response.json(await emailAiStudio(request, action, await readJsonBody(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

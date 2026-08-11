import { jsonError, readJsonBody } from "@/lib/server/api-utils";
import { emailAiStatus, generateEmailSuggestion } from "@/lib/server/email-ai";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { return Response.json(await emailAiStatus(request), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try { return Response.json(await generateEmailSuggestion(request, await readJsonBody(request))); }
  catch (error) { return jsonError(error); }
}

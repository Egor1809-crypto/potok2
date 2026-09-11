import { sendEmailBuilderTest } from "@/lib/server/email-test-send";
import { jsonError, readJsonBody } from "@/lib/server/api-utils";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { return Response.json(await sendEmailBuilderTest(request, await readJsonBody(request)), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return jsonError(error); }
}

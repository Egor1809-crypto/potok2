import { jsonError } from "@/lib/server/api-utils";
import { exportCampaignManualCsv } from "@/lib/server/mailflow-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await exportCampaignManualCsv(
      request,
      url.searchParams.get("id"),
    );
    return new Response(result.csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Mailflow-Recipient-Count": String(result.count),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

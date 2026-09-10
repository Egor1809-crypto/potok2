import { getD1 } from "@/db";
import { WORKSPACE_ID } from "./database-init";
import { buildCalendarReport, calendarReportSql, type StoredReportRow } from "@/lib/calendar/report";

// Called only by the authenticated calendar workspace loader.
export async function calendarReport() {
  const to = new Date().toISOString();
  const from = new Date(Date.parse(to) - 24 * 60 * 60 * 1000).toISOString();
  const result = await getD1().prepare(calendarReportSql)
    .bind(WORKSPACE_ID, from, to, WORKSPACE_ID, from, to, from, to).all<StoredReportRow>();
  return buildCalendarReport(result.results, from, to);
}

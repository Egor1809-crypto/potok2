import { getWorkspaceId } from "./workspace-context";
import type { ParticipantRecord } from "@/types/api";
import { isTeamAdmin } from "@/lib/team-access";
import { getD1 } from "@/db";

import { buildCalendarReport, calendarReportSql, type StoredReportRow } from "@/lib/calendar/report";

// Called only by the authenticated calendar workspace loader.
export async function calendarReport(actor: ParticipantRecord) {
  const to = new Date().toISOString();
  const from = new Date(Date.parse(to) - 24 * 60 * 60 * 1000).toISOString();
  const result = await getD1().prepare(`${calendarReportSql} AND (?=1 OR c.participant_id=?)`)
    .bind(getWorkspaceId(), from, to, getWorkspaceId(), from, to, from, to, isTeamAdmin(actor) ? 1 : 0, actor.id).all<StoredReportRow>();
  return buildCalendarReport(result.results, from, to);
}

export type ReportState = "sent" | "partial" | "not_sent" | "pending" | "cancelled";
export const reportLabels: Record<ReportState, string> = {
  sent: "Отправлено", partial: "Частично", not_sent: "Не отправлено", pending: "В процессе / нет подтверждения", cancelled: "Отменено",
};
export type CalendarReportRow = {
  id: string; name: string; subject: string; sender: string; activityAt: string;
  scheduledAt: string | null; sentAt: string | null; state: ReportState;
  label: string; reason: string; recipients: number; sent: number; delivered: number;
  errors: number; uncertain: number; manual: number;
};
export type CalendarReport = {
  from: string; to: string; rows: CalendarReportRow[];
  counts: Record<ReportState, number>;
};
export type StoredReportRow = {
  id: string; name: string; subject: string; sender_email: string; status: string;
  status_reason: string; scheduled_at: string | null; sent_at: string | null;
  metrics: string; event_at: string | null; job_status: string | null;
  rejected_count: number | null; ambiguous_count: number | null; manual_count: number | null;
  job_message: string | null;
};
// Select actual dispatch/stop activity, never mutable updated_at or statistics
// polling. A future scheduled campaign is excluded until it is due.
export const calendarReportSql = `WITH activity AS (
  SELECT campaign_id, max(occurred_at) AS event_at FROM campaign_events
  WHERE workspace_id=? AND julianday(occurred_at)>=julianday(?) AND julianday(occurred_at)<=julianday(?)
  AND type IN ('dispatch_started','dispatch_completed','dispatch_partial','dispatch_blocked','launch_blocked','campaign_cancelled','provider_schedule_due')
  GROUP BY campaign_id
)
SELECT c.id,c.name,c.subject,c.sender_email,c.status,c.status_reason,c.scheduled_at,c.sent_at,c.metrics,
  a.event_at,j.status AS job_status,j.rejected_count,j.ambiguous_count,j.manual_count,j.status_message AS job_message
FROM campaigns c LEFT JOIN activity a ON a.campaign_id=c.id
LEFT JOIN delivery_jobs j ON j.id=(SELECT id FROM delivery_jobs WHERE campaign_id=c.id AND workspace_id=c.workspace_id ORDER BY created_at DESC,id DESC LIMIT 1)
WHERE c.workspace_id=? AND (
  (julianday(c.scheduled_at)>=julianday(?) AND julianday(c.scheduled_at)<=julianday(?)) OR
  (julianday(c.sent_at)>=julianday(?) AND julianday(c.sent_at)<=julianday(?)) OR a.event_at IS NOT NULL
)`;
const count = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
export function buildCalendarReport(stored: StoredReportRow[], from: string, to: string): CalendarReport {
  const counts: CalendarReport["counts"] = { sent: 0, partial: 0, not_sent: 0, pending: 0, cancelled: 0 };
  const rows = stored.map((row): CalendarReportRow => {
    let metrics: Record<string, unknown> = {};
    try { metrics = JSON.parse(row.metrics) ?? {}; } catch { /* Missing metrics remain unknown, never successful. */ }
    const sent = count(metrics.sent), delivered = count(metrics.delivered);
    const errors = Math.max(count(metrics.bounced), count(row.rejected_count));
    const uncertain = count(row.ambiguous_count), manual = count(row.manual_count);
    let state: ReportState = "pending";
    if (row.status === "cancelled") state = "cancelled";
    else if (sent > 0 && (errors > 0 || manual > 0 || row.job_status === "partial" || row.status === "blocked")) state = "partial";
    else if (uncertain > 0 || row.status === "sending" || row.job_status === "processing" || row.job_status === "queued") state = "pending";
    else if (row.status === "blocked" || row.job_status === "failed" || row.job_status === "manual_required") state = "not_sent";
    else if (sent > 0) state = "sent";
    else if (row.status === "scheduled") state = "pending";
    const time = [row.event_at, row.sent_at, row.scheduled_at].filter((value): value is string => Boolean(value))
      .map(value => Date.parse(value)).filter(value => value >= Date.parse(from) && value <= Date.parse(to));
    const label = state === "sent" && delivered >= sent ? "Доставлено" : state === "pending"
      ? uncertain ? "Нет подтверждения" : row.status === "scheduled" ? "Ожидает запуска" : "Ожидает подтверждения" : reportLabels[state];
    counts[state]++;
    return { id: row.id, name: row.name, subject: row.subject, sender: row.sender_email,
      activityAt: new Date(Math.max(...time, Date.parse(from))).toISOString(), scheduledAt: row.scheduled_at,
      sentAt: row.sent_at, state, label,
      reason: row.status_reason || row.job_message || "Проверьте подробности рассылки.",
      recipients: count(metrics.recipients), sent, delivered, errors, uncertain, manual };
  }).sort((a, b) => b.activityAt.localeCompare(a.activityAt) || a.id.localeCompare(b.id));
  return { from, to, rows, counts };
}

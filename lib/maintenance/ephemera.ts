/** Only expired technical state: no contacts, files, messages, campaigns or audit evidence. */
export const EPHEMERAL_RETENTION_DAYS = 7;
const DAY = 86_400_000;
const BATCH_LIMIT = 500;
export type MaintenanceReport = {
  workspaceId: string;
  completedAt: string;
  expiredSessions: number;
  oldAiRequests: number;
  oldRateCounters: number;
  backlog: boolean;
};

export async function pruneProjectEphemera(db: D1Database, workspaceId: string, now = new Date()): Promise<MaintenanceReport | null> {
  if (!workspaceId || !Number.isFinite(now.getTime())) throw new Error("Invalid maintenance scope.");
  const stamp = now.toISOString(), cutoff = new Date(now.getTime() - EPHEMERAL_RETENTION_DAYS * DAY).toISOString();
  const key = `maintenance:${workspaceId}:ephemera:v1`, lease = new Date(now.getTime() + 5 * 60_000).toISOString();
  // Atomic, database-backed lease works across Worker isolates and cron/fetch overlap.
  const claimed = await db.prepare(`INSERT INTO system_state (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
    WHERE system_state.value <= ? RETURNING key`).bind(key, lease, stamp, stamp).first();
  if (!claimed) return null;
  try {
    const results = await db.batch([
      db.prepare(`DELETE FROM auth_sessions WHERE id IN (
        SELECT s.id FROM auth_sessions s JOIN participants p ON p.id=s.participant_id
        WHERE p.workspace_id=? AND s.expires_at<? LIMIT ?
      )`).bind(workspaceId, cutoff, BATCH_LIMIT),
      db.prepare(`DELETE FROM ai_idempotency WHERE workspace_id=? AND key IN (
        SELECT key FROM ai_idempotency WHERE workspace_id=? AND updated_at<? LIMIT ?
      )`).bind(workspaceId, workspaceId, cutoff, BATCH_LIMIT),
      db.prepare(`DELETE FROM ai_request_limits WHERE workspace_id=? AND key IN (
        SELECT key FROM ai_request_limits WHERE workspace_id=? AND updated_at<? LIMIT ?
      )`).bind(workspaceId, workspaceId, cutoff, BATCH_LIMIT),
    ]);
    const counts = results.map(r => Number(r.meta.changes || 0));
    const report: MaintenanceReport = { workspaceId, completedAt: stamp, expiredSessions: counts[0], oldAiRequests: counts[1], oldRateCounters: counts[2], backlog: counts.some(n => n === BATCH_LIMIT) };
    const next = new Date(now.getTime() + (report.backlog ? 5 * 60_000 : DAY)).toISOString();
    await db.batch([
      db.prepare("UPDATE system_state SET value=?, updated_at=? WHERE key=? AND value=?").bind(next, stamp, key, lease),
      db.prepare(`INSERT INTO system_state (key,value,updated_at) VALUES (?,?,?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).bind(`${key}:last-report`, JSON.stringify(report), stamp),
    ]);
    return report;
  } catch (error) {
    await db.prepare("DELETE FROM system_state WHERE key=? AND value=?").bind(key, lease).run().catch(() => undefined);
    throw error;
  }
}

import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildCalendarReport, calendarReportSql } from "../lib/calendar/report.ts";

const from = "2026-09-09T12:00:00.000Z", to = "2026-09-10T12:00:00.000Z";
const base = { id: "c", name: "Рассылка", subject: "Тема", sender_email: "sender@example.org", status: "completed", status_reason: "Провайдер принял письма", scheduled_at: null, sent_at: to, metrics: '{"recipients":10,"sent":10,"delivered":0}', event_at: null, job_status: "completed", rejected_count: 0, ambiguous_count: 0, manual_count: 0, job_message: null };

test("report distinguishes dispatch, delivery, partial failure and unknown outcomes", () => {
  const report = buildCalendarReport([
    base,
    { ...base, id: "delivered", metrics: '{"sent":10,"delivered":10}' },
    { ...base, id: "partial", job_status: "partial", rejected_count: 2, metrics: '{"sent":8,"bounced":2}' },
    { ...base, id: "blocked", status: "blocked", job_status: null, metrics: '{}' },
    { ...base, id: "unknown", status: "blocked", job_status: "failed", ambiguous_count: 10, metrics: '{}' },
    { ...base, id: "due", status: "scheduled", job_status: null, metrics: '{}', sent_at: null, scheduled_at: from },
    { ...base, id: "cancelled", status: "cancelled", metrics: '{}' },
    { ...base, id: "manual", status: "ready", job_status: "manual_required", manual_count: 10, metrics: '{}' },
  ], from, to);
  const get = id => report.rows.find(row => row.id === id);
  assert.equal(get("c").label, "Отправлено");
  assert.equal(get("c").delivered, 0);
  assert.equal(get("delivered").label, "Доставлено");
  assert.equal(get("partial").errors, 2); // Never sum the same rejection twice.
  assert.equal(get("unknown").state, "pending");
  assert.equal(get("due").label, "Ожидает запуска");
  assert.deepEqual(report.counts, { sent: 2, partial: 1, not_sent: 2, pending: 2, cancelled: 1 });
});

test("SQL covers exactly the last 24 hours, isolates workspace and ignores refreshed old statistics", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE campaigns(id TEXT,workspace_id TEXT,name TEXT,subject TEXT,sender_email TEXT,status TEXT,status_reason TEXT,scheduled_at TEXT,sent_at TEXT,metrics TEXT);
    CREATE TABLE campaign_events(campaign_id TEXT,workspace_id TEXT,occurred_at TEXT,type TEXT);
    CREATE TABLE delivery_jobs(id TEXT,campaign_id TEXT,workspace_id TEXT,status TEXT,rejected_count INTEGER,ambiguous_count INTEGER,manual_count INTEGER,status_message TEXT,created_at TEXT);`);
  const add = (id, scheduled, sent, workspace="mine") => db.prepare("INSERT INTO campaigns VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,workspace,id,"","","completed","",scheduled,sent,"{}");
  add("boundary", from, null);
  add("outside", "2026-09-09T11:59:59.999Z", null);
  add("future", "2026-09-10T12:00:00.001Z", null);
  add("instant", null, to);
  add("other", to, null, "another-workspace");
  add("blocked", null, null);
  add("old-synced", "2026-09-01T00:00:00Z", "2026-09-01T00:01:00Z");
  db.prepare("INSERT INTO campaign_events VALUES(?,?,?,?)").run("blocked","mine",to,"dispatch_blocked");
  db.prepare("INSERT INTO campaign_events VALUES(?,?,?,?)").run("old-synced","mine",to,"delivery_synced");
  db.prepare("INSERT INTO delivery_jobs VALUES(?,?,?,?,?,?,?,?,?)").run("old","instant","mine","failed",1,0,0,"Старая ошибка",from);
  db.prepare("INSERT INTO delivery_jobs VALUES(?,?,?,?,?,?,?,?,?)").run("latest","instant","mine","completed",0,0,0,"Принято",to);
  const rows = db.prepare(calendarReportSql).all("mine",from,to,"mine",from,to,from,to);
  assert.deepEqual(rows.map(row => row.id).sort(), ["blocked","boundary","instant"]);
  assert.equal(rows.find(row => row.id === "instant").job_status,"completed");
  db.close();
});

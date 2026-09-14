import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { pruneProjectEphemera } from '../lib/maintenance/ephemera.ts';
function fixture() {
 const sql = new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE system_state (key TEXT PRIMARY KEY,value TEXT,updated_at TEXT);
 CREATE TABLE participants(id TEXT PRIMARY KEY,workspace_id TEXT);
 CREATE TABLE auth_sessions(id TEXT PRIMARY KEY,participant_id TEXT,expires_at TEXT);
 CREATE TABLE ai_idempotency(key TEXT PRIMARY KEY,workspace_id TEXT,status TEXT,updated_at TEXT);
 CREATE TABLE ai_request_limits(key TEXT PRIMARY KEY,workspace_id TEXT,updated_at TEXT);
 CREATE TABLE contacts(id TEXT PRIMARY KEY,workspace_id TEXT);
 INSERT INTO participants VALUES('p','potok'),('other','another-project');
 INSERT INTO contacts VALUES('keep-contact','potok');
 INSERT INTO auth_sessions VALUES('expired','p','2026-08-01'),('active','p','2026-10-01'),('recent-expiry','p','2026-09-13'),('other-expired','other','2026-08-01');
 INSERT INTO ai_idempotency VALUES('old','potok','completed','2026-08-01'),('pending','potok','pending','2026-09-14'),('other-ai','another-project','completed','2026-08-01');
 INSERT INTO ai_request_limits VALUES('old','potok','2026-08-01'),('active','potok','2026-09-14'),('other-rate','another-project','2026-08-01');`);
 const db = {
  prepare(query) {
   let args=[];
   return {
    bind(...v){args=v;return this},
    async first(){return sql.prepare(query).get(...args)??null},
    async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}}},
   };
  },
  async batch(statements){sql.exec('BEGIN');try{const r=[];for(const stmt of statements)r.push(await stmt.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}},
 };
 return {sql,db};
}
test('maintenance removes only expired technical records in the requested project', async()=>{
 const {sql,db}=fixture();const report=await pruneProjectEphemera(db,'potok',new Date('2026-09-14T09:00:00Z'));
 assert.equal(report.expiredSessions,1);assert.equal(report.oldAiRequests,1);assert.equal(report.oldRateCounters,1);
 assert.deepEqual(sql.prepare('SELECT id FROM auth_sessions ORDER BY id').all().map(r=>r.id),['active','other-expired','recent-expiry']);
 assert.equal(sql.prepare("SELECT count(*) n FROM ai_idempotency WHERE workspace_id='another-project'").get().n,1);
 assert.equal(sql.prepare("SELECT count(*) n FROM ai_request_limits WHERE workspace_id='another-project'").get().n,1);
 assert.equal(sql.prepare('SELECT count(*) n FROM contacts').get().n,1);sql.close();
});
test('daily lease prevents duplicate cleanup across requests and permits the next day', async()=>{
 const {sql,db}=fixture();const now=new Date('2026-09-14T09:00:00Z');assert.ok(await pruneProjectEphemera(db,'potok',now));
 assert.equal(await pruneProjectEphemera(db,'potok',now),null);assert.equal(await pruneProjectEphemera(db,'potok',new Date('2026-09-14T10:00:00Z')),null);
 assert.ok(await pruneProjectEphemera(db,'potok',new Date('2026-09-15T09:01:00Z')));sql.close();
});
test('cleanup is bounded and schedules another batch for a backlog', async()=>{
 const {sql,db}=fixture();const insert=sql.prepare('INSERT INTO ai_request_limits VALUES(?,?,?)');for(let i=0;i<700;i++)insert.run('old-'+i,'potok','2026-08-01');
 const now=new Date('2026-09-14T09:00:00Z');const report=await pruneProjectEphemera(db,'potok',now);assert.equal(report.oldRateCounters,500);assert.equal(report.backlog,true);
 assert.equal(await pruneProjectEphemera(db,'potok',now),null);const next=await pruneProjectEphemera(db,'potok',new Date('2026-09-14T09:06:00Z'));assert.equal(next.oldRateCounters,201);sql.close();
});
test('an interrupted cleanup lease expires, and an invalid scope cannot delete anything', async()=>{
 const {sql,db}=fixture();sql.prepare('INSERT INTO system_state VALUES(?,?,?)').run('maintenance:potok:ephemera:v1','2026-09-14T09:05:00.000Z','2026-09-14T09:00:00.000Z');
 assert.equal(await pruneProjectEphemera(db,'potok',new Date('2026-09-14T09:04:00Z')),null);
 assert.ok(await pruneProjectEphemera(db,'potok',new Date('2026-09-14T09:06:00Z')));
 await assert.rejects(pruneProjectEphemera(db,'',new Date()),/scope/);sql.close();
});

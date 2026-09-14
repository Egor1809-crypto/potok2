import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { eq } from 'drizzle-orm';
import { contacts } from '../db/schema.ts';
import { loadAiServer } from './helpers/ai-server-harness.mjs';

test('contact sorting covers all filtered pages with deterministic ties and an allowlisted fallback', async () => {
  const { contactListOrder } = await loadAiServer('lib/server/contact-list-order.ts', { overrides: {'@/db/schema': { contacts }} });
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE contacts(id TEXT PRIMARY KEY,workspace_id TEXT,full_name TEXT,updated_at TEXT)');
  for (const row of [['a','ours','Яна','2026-09-12'],['b','ours','Анна','2026-09-13'],['c','ours','Анна','2026-09-13'],['d','ours','Борис','2026-09-14'],['hidden','other','А','2026-09-15']]) sqlite.prepare('INSERT INTO contacts VALUES(?,?,?,?)').run(...row);
  const db = drizzle(async () => ({rows:[]}));
  const page = (sort,offset) => {
    const query = db.select({id:contacts.id}).from(contacts).where(eq(contacts.workspaceId,'ours')).orderBy(...contactListOrder(sort)).limit(2).offset(offset).toSQL();
    return sqlite.prepare(query.sql).all(...query.params).map(row => row.id);
  };
  try {
    for (const [sort,expected] of [['name-asc',['b','c','d','a']],['name-desc',['a','d','c','b']],['updated-asc',['a','b','c','d']],['updated-desc',['d','c','b','a']],['name; DROP TABLE contacts;--',['d','c','b','a']]]) {
      assert.deepEqual([...page(sort,0),...page(sort,2)],expected);
    }
    assert.equal(sqlite.prepare('SELECT count(*) n FROM contacts').get().n,5);
  } finally { sqlite.close(); }
});

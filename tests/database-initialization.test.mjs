import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../lib/server/database-init.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const version = source.match(/const RUNTIME_SCHEMA_VERSION = "([^"]+)"/)[1];
async function loadDatabaseInitializer(readMarker) {
  const context = vm.createContext({ Request, console });
  let reads = 0, writes = 0;
  const d1 = { prepare: () => ({ bind() { return this; }, run: async () => { writes++; }, first: () => readMarker(++reads) }) };
  const dependencies = {
    'drizzle-orm': { and: () => {}, eq: () => {} },
    '@/db': { getD1: () => d1, getDb: () => { throw new Error('Unexpected full migration'); } },
    '@/db/schema': Object.fromEntries(['emailTemplates', 'integrations', 'participants', 'systemState', 'workspaces'].map(name => [name, {}])),
    '@/config/integrations': { integrationProviders: [] },
    '@/config/brand': { BRAND_NAME: 'Поток' },
    './workspace-context': { LEGACY_WORKSPACE_ID:'workspace-main', withWorkspace: (_id, operation) => operation() },
    './yandex-schema': { yandexSchema: [] },
    './api-utils': { ApiRequestError: Error },
    './starter-template-library': { starterEmailTemplateValues: [] },
    '@/data/conference-production-templates.generated': { conferenceProductionTemplateValues: [] },
    './team-auth': { requireTeamSession: () => {}, toTeamParticipant: () => {} },
  };
  const mod = new vm.SourceTextModule(code, { context });
  await mod.link(specifier => {
    const values = dependencies[specifier];
    assert.ok(values, specifier);
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  });
  await mod.evaluate();
  return { ensure: mod.namespace.ensureSystemDatabase, counts: () => ({ reads, writes }) };
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function within(promise) { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('A different request is blocking this request')), 150); })]); } finally { clearTimeout(timer); } }

test('an abandoned request does not prevent a new login from initializing the database', async () => {
  const abandoned = deferred();
  const db = await loadDatabaseInitializer(count => count === 1 ? abandoned.promise : Promise.resolve({ value: version }));
  const first = db.ensure();
  await Promise.resolve();
  await within(db.ensure());
  assert.equal(db.counts().reads, 2);
  abandoned.resolve({ value: version }); await first;
});

test('only successful initialization is cached; temporary failures can be retried', async () => {
  const db = await loadDatabaseInitializer(count => count === 1 ? Promise.reject(new Error('D1 unavailable')) : Promise.resolve({ value: version }));
  await assert.rejects(db.ensure(), /D1 unavailable/);
  await db.ensure(); const readyCounts = db.counts();
  await db.ensure(); assert.deepEqual(db.counts(), readyCounts);
});

test('a late failure of an older request cannot invalidate another request’s success', async () => {
  const older = deferred();
  const db = await loadDatabaseInitializer(count => count === 1 ? older.promise : Promise.resolve({ value: version }));
  const first = db.ensure(); const firstFailure = assert.rejects(first, /canceled/);
  await Promise.resolve(); await within(db.ensure());
  const readyCounts = db.counts(); older.reject(new Error('request canceled')); await firstFailure;
  await db.ensure(); assert.deepEqual(db.counts(), readyCounts);
});


test('a migrated database cold start performs one read and no DDL, seed imports or account writes', async () => {
  const db = await loadDatabaseInitializer(() => Promise.resolve({ value: version }));
  await db.ensure();
  assert.deepEqual(db.counts(), { reads: 1, writes: 0 });
});

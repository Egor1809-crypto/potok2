import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as fflate from "fflate";
import * as orm from "drizzle-orm";
import * as sqliteCore from "drizzle-orm/sqlite-core";

// Exercise the production orchestration without touching contacts, storage or mail.
export async function loadAiServer(entry, { env = {}, fetch = globalThis.fetch, expose = [], assetStore, overrides = {} } = {}) {
  const root = path.resolve(import.meta.dirname, "../..");
  const context = vm.createContext({ console, process: { env: { NODE_ENV: "test" } }, fetch, crypto, structuredClone, URL, URLSearchParams, Request, Response, Headers, AbortController, AbortSignal, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, atob, btoa, setTimeout, clearTimeout });
  const synthetic = (values) => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
  const db = { prepare(sql) { return { bind() { return this; }, async run() { return { meta: { changes: 1 } }; }, async first() { return sql.includes("RETURNING request_count") ? { request_count: 1 } : null; } }; } };
  const mocks = {
    "cloudflare:workers": synthetic({ env }),
    "./workspace-context": synthetic({getWorkspaceId: () => overrides["./database-init"]?.WORKSPACE_ID ?? "design-evaluation", cachedWorkspaceSession: () => undefined, isLegacyWorkspace: () => true, LEGACY_WORKSPACE_ID:"workspace-main", withWorkspace: (_id, operation) => operation()}),
    "fflate": synthetic(fflate),
    "drizzle-orm": synthetic(orm),
    "drizzle-orm/sqlite-core": synthetic(sqliteCore),
    "@/db": synthetic({ getD1: () => db }),
    "./database-init": synthetic({ ensureDatabase: async () => ({ participant: { id: "design-evaluation" }, sessionId: "test-session" }), WORKSPACE_ID: "design-evaluation" }),
    "./email-asset-store": synthetic({ storeGeneratedEmailAsset: async () => { throw new Error("Asset writes are disabled in design tests"); }, storeGeneratedEmailAssetBytes: async () => { throw new Error("Asset writes are disabled in design tests"); }, getEmailAssetRecord: async () => { throw new Error("Unknown test asset"); }, ...assetStore }),
    "./public-domain-image-store": synthetic({ storePublicDomainFallbackImage: async () => null }),
    ...Object.fromEntries(Object.entries(overrides).map(([name, exports]) => [name, synthetic(exports)])),
  };
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    const source = readFileSync(path.join(root, file), "utf8");
    if (file.endsWith(".json")) {
      const jsonModule = synthetic({ default: JSON.parse(source) });
      modules.set(file, jsonModule);
      return jsonModule;
    }
    const code = ts.transpileModule(source + (file === entry && expose.length ? `\nexport { ${expose.join(", ")} };` : ""), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const loadedModule = new vm.SourceTextModule(code, { context, identifier: file, importModuleDynamically: async (specifier) => {
      if (mocks[specifier]) { if (mocks[specifier].status === "unlinked") await mocks[specifier].link(() => {}); if (mocks[specifier].status !== "evaluated") await mocks[specifier].evaluate(); return mocks[specifier]; }
      throw new Error(`Dynamic test import needs an explicit mock: ${specifier}`);
    } });
    modules.set(file, loadedModule);
    return loadedModule;
  }
  const loadedModule = await load(entry);
  await loadedModule.link(async (specifier, referencingModule) => {
    if (mocks[specifier]) return mocks[specifier];
    let resolved = specifier.startsWith("@/") ? specifier.slice(2) : path.join(path.dirname(referencingModule.identifier), specifier);
    if (!path.extname(resolved)) resolved += ".ts";
    return load(resolved);
  });
  await loadedModule.evaluate();
  return loadedModule.namespace;
}

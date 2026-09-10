import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

// Exercise the production orchestration without touching contacts, storage or mail.
export async function loadAiServer(entry, { env = {}, fetch = globalThis.fetch, expose = [], assetStore } = {}) {
  const root = path.resolve(import.meta.dirname, "../..");
  const context = vm.createContext({ console, fetch, crypto, URL, Request, Response, Headers, AbortSignal, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, atob, btoa, setTimeout, clearTimeout });
  const synthetic = (values) => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
  const db = { prepare(sql) { return { bind() { return this; }, async run() { return { meta: { changes: 1 } }; }, async first() { return sql.includes("RETURNING request_count") ? { request_count: 1 } : null; } }; } };
  const mocks = {
    "cloudflare:workers": synthetic({ env }),
    "@/db": synthetic({ getD1: () => db }),
    "./database-init": synthetic({ ensureDatabase: async () => {}, WORKSPACE_ID: "design-evaluation" }),
    "./email-asset-store": synthetic(assetStore ?? { storeGeneratedEmailAsset: async () => { throw new Error("Asset writes are disabled in design tests"); }, storeGeneratedEmailAssetBytes: async () => { throw new Error("Asset writes are disabled in design tests"); } }),
    "./public-domain-image-store": synthetic({ storePublicDomainFallbackImage: async () => null }),
  };
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    const source = await readFile(path.join(root, file), "utf8");
    const code = ts.transpileModule(source + (file === entry && expose.length ? `\nexport { ${expose.join(", ")} };` : ""), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const loadedModule = new vm.SourceTextModule(code, { context, identifier: file });
    modules.set(file, loadedModule);
    await loadedModule.link(async (specifier) => {
      if (mocks[specifier]) return mocks[specifier];
      let resolved = specifier.startsWith("@/") ? specifier.slice(2) : path.join(path.dirname(file), specifier);
      if (!path.extname(resolved)) resolved += ".ts";
      return load(resolved);
    });
    return loadedModule;
  }
  const loadedModule = await load(entry);
  await loadedModule.evaluate();
  return loadedModule.namespace;
}

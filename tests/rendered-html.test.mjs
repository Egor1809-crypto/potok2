import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://mailflow.test"), {
      headers: { accept: "text/html", host: "mailflow.test" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished MAILFLOW landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /MAILFLOW/);
  assert.match(html, /Деловые рассылки/);
  assert.match(html, /Наконец-то порядок/);
  assert.match(html, /Попробовать бесплатно/);
  assert.match(html, /Все деловые связи/);
  assert.match(html, /<html[^>]+lang="ru"/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|Your site is taking shape|react-loading-skeleton/i);
});

test("all key product routes render without a dead end", async () => {
  const paths = [
    "/login",
    "/register",
    "/dashboard",
    "/contacts",
    "/contacts/contact-ivan-petrov",
    "/companies",
    "/segments",
    "/import",
    "/campaigns",
    "/campaigns/new?audience=segment-moscow-lawyers&count=843",
    "/campaigns/campaign-legal-conference",
    "/email-builder?template=template-legal-conference",
    "/templates",
    "/analytics",
    "/settings",
  ];

  for (const pathname of paths) {
    const response = await render(pathname);
    assert.equal(response.status, 200, `${pathname} should render`);
    const html = await response.text();
    assert.doesNotMatch(html, /page not found|internal server error/i, pathname);
  }
});

test("starter artifacts are replaced with project metadata and assets", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
    access(new URL("../public/favicon.svg", import.meta.url)),
  ]);

  assert.match(page, /LandingPage/);
  assert.match(layout, /brandConfig/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /og\.png/);
  assert.match(packageJson, /"name": "mailflow-mvp"/);
  assert.match(packageJson, /"lucide-react"/);
  assert.match(packageJson, /"recharts"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/", projectRoot)));
});

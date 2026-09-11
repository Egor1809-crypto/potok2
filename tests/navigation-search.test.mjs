import assert from "node:assert/strict";
import test from "node:test";
import { navigationSearchEntries, normalizeNavigationQuery, searchNavigation, nextSearchIndex } from "../lib/navigation-search.ts";
import { containTabFocus } from "../components/layout/focus-management.ts";

test("exact sections outrank related actions; destinations appear only once", () => {
  assert.equal(searchNavigation("контакты")[0].href, "/contacts");
  assert.equal(searchNavigation("календарь")[0].href, "/calendar");
  assert.equal(searchNavigation("шаблоны писем")[0].href, "/templates");
  assert.equal(navigationSearchEntries.length, new Set(navigationSearchEntries.map(item => item.href)).size);
  assert.equal(navigationSearchEntries.filter(item => item.href === "/email-builder?new=1").length, 1);
});

test("multiple words match independently of order, with aliases and Russian endings", () => {
  for (const query of ["импорт html", "html импорт", "письмо импорт", "импорт письма"]) assert.equal(searchNavigation(query)[0].href, "/templates?import=1", query);
  assert.equal(searchNavigation("презентация шаблоны")[0].href, "/presentations?view=templates");
  assert.equal(searchNavigation("настройки smtp")[0].href, "/integrations");
  assert.equal(searchNavigation("новая рассылка")[0].href, "/campaigns/new?channel=email");
  assert.equal(searchNavigation("статистика")[0].href, "/analytics");
  assert.equal(searchNavigation("отчёты")[0].href, "/analytics");
  assert.equal(normalizeNavigationQuery("  ОТЧЁТЫ  за\nсутки!  "), "отчеты за сутки");
});

test("small typos and an English keyboard layout still find the intended section", () => {
  for (const query of ["календрь", "каллендарь", "каленадрь", "rfktylfhm"]) assert.equal(searchNavigation(query)[0].href, "/calendar", query);
  assert.equal(searchNavigation("rjynfrns")[0].href, "/contacts");
  assert.equal(searchNavigation("zzzz презентация шаблоны").length, 0);
  assert.ok(searchNavigation("email").length > 0, "English aliases remain available");
});

test("empty and unrelated queries stay useful without fabricated matches", () => {
  assert.ok(searchNavigation("  ").some(item => item.href === "/calendar"));
  assert.deepEqual(searchNavigation("несуществующий-отдел-землетрясений"), []);
  assert.deepEqual(searchNavigation("календарь несуществующий"), []);
  for (const entry of navigationSearchEntries) assert.ok(entry.href.startsWith("/") && !entry.href.startsWith("//"));
});

test("keyboard selection wraps in both directions and handles an empty result set", () => {
  assert.equal(nextSearchIndex(0, "ArrowUp", 3), 2);
  assert.equal(nextSearchIndex(2, "ArrowDown", 3), 0);
  assert.equal(nextSearchIndex(1, "Home", 3), 0);
  assert.equal(nextSearchIndex(1, "End", 3), 2);
  assert.equal(nextSearchIndex(0, "ArrowDown", 0), 0);
});

test("modal focus ignores hidden and arrow-managed options when wrapping Tab", t => {
  const focused = [];
  const control = (name, tabIndex = 0, visible = true) => ({ tabIndex, closest: () => null, getClientRects: () => visible ? [{}] : [], focus: () => focused.push(name) });
  const first = control("close"), last = control("input"), option = control("result", -1), hidden = control("hidden", 0, false);
  const container = { querySelectorAll: () => [first, last, option, hidden], contains: element => [first, last, option, hidden].includes(element) };
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { value: { activeElement: last }, configurable: true });
  t.after(() => { if (original) Object.defineProperty(globalThis, "document", original); else delete globalThis.document; });
  let prevented = false;
  containTabFocus({ key: "Tab", shiftKey: false, preventDefault: () => { prevented = true; } }, container);
  assert.equal(prevented, true);
  assert.deepEqual(focused, ["close"]);
  document.activeElement = first;
  containTabFocus({ key: "Tab", shiftKey: true, preventDefault() {} }, container);
  assert.deepEqual(focused, ["close", "input"]);
});

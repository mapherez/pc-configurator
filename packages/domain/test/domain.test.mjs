import test from "node:test";
import assert from "node:assert/strict";
import {
  ComponentSchema,
  BuildSchema,
  defaultSettings,
  resolveSettings,
  price,
  evaluateBuild,
  dictionaries,
  translate,
} from "../dist/index.js";
const component = (
  id,
  category,
  specs = {},
  offers = [{ market: "pt", currency: "EUR", netMinor: 39999, available: true }],
) =>
  ComponentSchema.parse({
    id,
    category,
    sku: id,
    name: id,
    brand: "Example",
    status: "published",
    specs,
    offers,
  });
const cpu = component("cpu-test", "cpu", { socket: "AM5", tdp: 65 });
const board = component("board-test", "motherboard", {
  socket: "AM5",
  ram_type: "DDR5",
  form_factor: "ATX",
  ram_slots: 4,
  storage_slots: 2,
});
const ram = component("ram-test", "ram", { type: "DDR5", sticks: 2 });
const gpu = component("gpu-test", "gpu", { tdp: 200, length_mm: 300 });
const enclosure = component("case-test", "case", { mobo_support: ["ATX"], max_gpu_length_mm: 350 });
const psu = component("psu-test", "psu", { wattage: 750 });
const cooler = component("cooler-test", "cooler", { sockets: ["AM5"] });
const storage = component("storage-test", "storage");
const parts = [cpu, board, ram, gpu, enclosure, psu, cooler, storage];
const build = (lines = [], market = "pt") => ({ version: 1, market, language: "pt-PT", lines });
const line = (slot, part, quantity = 1) => ({ slot, componentId: part.id, quantity });

void test("market prices use their own currency and never fall back to another market", () => {
  const part = component("global-cpu", "cpu", {}, [
    ...cpu.offers,
    { market: "us", currency: "USD", netMinor: 30000, available: true },
  ]);
  const settings = resolveSettings({ markets: { us: { taxBasisPoints: 725 } } });
  assert.deepEqual(price(part, "pt", settings), { net: 39999, tax: 9200, gross: 49199 });
  assert.deepEqual(price(part, "us", settings), { net: 30000, tax: 2175, gross: 32175 });
  assert.equal(price(part, "us", defaultSettings), null);
  assert.equal(
    price(
      component("wrong-currency", "cpu", {}, [{ ...cpu.offers[0], currency: "USD" }]),
      "pt",
      settings,
    ),
    null,
  );
  assert.equal(
    price(
      component("unlisted", "cpu", {}, [{ ...cpu.offers[0], available: false }]),
      "pt",
      settings,
    ),
    null,
  );
});
void test("tax rounds once per line after quantities, including zero tax and large values", () => {
  const part = component("fan-test", "fan", {}, [{ ...cpu.offers[0], netMinor: 1 }]);
  assert.deepEqual(price(part, "pt", defaultSettings, 3), { net: 3, tax: 1, gross: 4 });
  assert.deepEqual(
    price(part, "pt", resolveSettings({ markets: { pt: { taxBasisPoints: 0 } } }), 3),
    { net: 3, tax: 0, gross: 3 },
  );
  assert.throws(() => price(part, "pt", defaultSettings, 1.5));
  const large = component("large", "fan", {}, [{ ...cpu.offers[0], netMinor: 100000000 }]);
  assert.equal(price(large, "pt", defaultSettings, 16).gross, 1968000000);
});
void test("settings overrides preserve defaults, arrays replace and explicit null stays unknown", () => {
  const settings = resolveSettings({
    global: { defaultMarket: "us", features: { exampleBuild: false } },
    markets: { pt: { taxBasisPoints: null } },
  });
  assert.equal(settings.global.defaultLanguage, "pt-PT");
  assert.equal(settings.global.features.exampleBuild, false);
  assert.equal(settings.global.features.priceFilter, true);
  assert.equal(settings.markets.pt.taxBasisPoints, null);
  assert.equal(defaultSettings.markets.pt.taxBasisPoints, 2300);
  assert.throws(() => resolveSettings({ global: { defaultMarket: "missing" } }));
  assert.throws(() =>
    resolveSettings({
      global: { slots: [...defaultSettings.global.slots, defaultSettings.global.slots[0]] },
    }),
  );
});
void test("shared contracts validate amounts, unique offers, quantities, slots and component specifications", () => {
  for (const netMinor of [-1, 0.1, NaN, Infinity])
    assert.throws(() =>
      ComponentSchema.parse({ ...cpu, offers: [{ ...cpu.offers[0], netMinor }] }),
    );
  assert.throws(() => ComponentSchema.parse({ ...cpu, offers: [...cpu.offers, ...cpu.offers] }));
  assert.throws(() => ComponentSchema.parse({ ...cpu, specs: { tdp: "65" } }));
  assert.throws(() => BuildSchema.parse(build([line("cpu", cpu), line("cpu", cpu)])));
  const result = evaluateBuild(
    build([line("cpu", ram), line("removed", cpu), line("ram", ram, 2)]),
    parts,
    defaultSettings,
  );
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["wrong_category", "unknown_slot", "invalid_quantity"],
  );
  assert.equal(result.total, null);
});
void test("compatibility evaluates every memory kit and capacity, never certifies missing data", () => {
  const lines = [
    line("cpu", cpu),
    line("motherboard", board),
    line("ram", ram),
    line("gpu", gpu),
    line("case", enclosure),
    line("psu", psu),
    line("cooler", cooler),
    line("storage", storage),
  ];
  const complete = evaluateBuild(build(lines), parts, defaultSettings);
  assert.equal(complete.complete, true);
  assert.equal(complete.compatibility.conflicts, false);
  assert.equal(complete.compatibility.pending, false);
  assert.equal(
    complete.total.gross,
    complete.lines.reduce((sum, entry) => sum + entry.amount.gross, 0),
  );
  const ddr4 = component("ddr4", "ram", { type: "DDR4", sticks: 4 });
  const conflict = evaluateBuild(
    build([...lines, line("ram-2", ddr4)]),
    [...parts, ddr4],
    defaultSettings,
  );
  assert.equal(conflict.compatibility.rules.find((rule) => rule.id === "ram").ok, false);
  assert.equal(conflict.compatibility.rules.find((rule) => rule.id === "ram_capacity").ok, false);
  const unknown = evaluateBuild(
    build([line("cpu", component("unknown-cpu", "cpu"))]),
    [component("unknown-cpu", "cpu")],
    defaultSettings,
  );
  assert.equal(unknown.compatibility.pending, true);
  assert.equal(unknown.compatibility.tdp, null);
  assert.equal(unknown.compatibility.recommended, null);
});
void test("unpublished and missing components keep builds unresolved and totals unknown", () => {
  for (const status of ["draft", "archived"]) {
    const result = evaluateBuild(build([line("cpu", cpu)]), [{ ...cpu, status }], defaultSettings);
    assert.deepEqual(result.issues, [{ slot: "cpu", code: "missing_component" }]);
    assert.equal(result.total, null);
    assert.equal(result.compatibility.pending, true);
  }
  assert.equal(evaluateBuild(build([], "us"), [], defaultSettings).total, null);
});
void test("locales have identical keys and interpolation contracts, including every rule", () => {
  const pt = dictionaries["pt-PT"],
    en = dictionaries["en-US"];
  assert.deepEqual(Object.keys(pt).sort(), Object.keys(en).sort());
  for (const key of Object.keys(pt))
    assert.deepEqual(
      [...pt[key].matchAll(/{{(.*?)}}/g)]
        .map((match) => match[1])
        .sort((a, b) => a.localeCompare(b)),
      [...en[key].matchAll(/{{(.*?)}}/g)]
        .map((match) => match[1])
        .sort((a, b) => a.localeCompare(b)),
      key,
    );
  const checks = evaluateBuild(build(), [], defaultSettings).compatibility;
  for (const rule of checks.rules) assert.ok(pt[`rule_${rule.id}`] && en[`rule_${rule.id}`]);
  assert.equal(translate("en-US", "position", { category: "Memory", index: 2 }), "Memory · 2");
});

void test("market feature overrides and monetary precision remain independent from the selected language", async () => {
  const { marketFeatures } = await import("../dist/index.js");
  const settings = resolveSettings({
    markets: {
      us: {
        features: { exampleBuild: false, priceFilter: false },
        taxBasisPoints: 0,
        minorDigits: 0,
      },
    },
  });
  assert.equal(marketFeatures(settings, "us").exampleBuild, false);
  assert.equal(marketFeatures(settings, "pt").exampleBuild, true);
  assert.equal(marketFeatures(settings, "us").compatibilityFilter, true);
  const part = component("us-cpu", "cpu", {}, [
    { market: "us", currency: "USD", netMinor: 100, available: true },
  ]);
  const ptBuild = { ...build([line("cpu", part)], "us"), language: "pt-PT" };
  const enBuild = { ...ptBuild, language: "en-US" };
  assert.deepEqual(
    evaluateBuild(ptBuild, [part], settings).total,
    evaluateBuild(enBuild, [part], settings).total,
  );
});

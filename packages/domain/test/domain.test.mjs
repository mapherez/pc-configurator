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
  max_ram_gb: 128,
  m2_slots: 2,
  sata_ports: 0,
  storage_interfaces: ["NVMe"],
  storage_connectors: ["M.2"],
  storage_slots: 2,
});
const ram = component("ram-test", "ram", { type: "DDR5", sticks: 2, size_gb: 32 });
const gpu = component("gpu-test", "gpu", { tdp: 200, length_mm: 300 });
const enclosure = component("case-test", "case", {
  mobo_support: ["ATX"],
  max_gpu_length_mm: 350,
  max_cpu_cooler_height_mm: 160,
  psu_support: ["ATX"],
  fan_slots: 4,
  fan_sizes_mm: [120, 140],
  fan_mounts_120: 4,
  fan_mounts_140: 2,
});
const psu = component("psu-test", "psu", { wattage: 750, form_factor: "ATX" });
const cooler = component("cooler-test", "cooler", { sockets: ["AM5"], height_mm: 155 });
const storage = component("storage-test", "storage", { connector: "M.2", interface: "NVMe" });
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

void test("management prices parse exact decimals and locale publication preserves placeholders", async () => {
  const { parseMoney, LocaleValuesSchema, translate } = await import("../dist/index.js");
  assert.equal(parseMoney("399,99", 2), 39999);
  assert.equal(parseMoney("1.005", 3), 1005);
  assert.equal(parseMoney("12", 0), 12);
  for (const value of ["-1", "1e3", "1.999", "NaN", "", "1.2.3"])
    assert.equal(parseMoney(value, 2), null);
  assert.equal(parseMoney("12.0", 0), null);
  assert.throws(() => LocaleValuesSchema.parse({ progress: "Missing parameters" }));
  assert.throws(() => LocaleValuesSchema.parse({ madeUpKey: "Text" }));
  assert.equal(
    translate("en-US", "title", {}, { "en-US": { title: "Published title" } }),
    "Published title",
  );
});

const fullLines = [
  line("cpu", cpu),
  line("motherboard", board),
  line("ram", ram),
  line("gpu", gpu),
  line("case", enclosure),
  line("psu", psu),
  line("cooler", cooler),
  line("storage", storage),
];
const ruleValue = (result, id) => result.compatibility.rules.find((rule) => rule.id === id)?.ok;
const withSpecs = (part, specs) =>
  ComponentSchema.parse({ ...part, specs: { ...part.specs, ...specs } });
const checkParts = (replacements = [], extras = [], settings = defaultSettings) =>
  evaluateBuild(
    build([...fullLines, ...extras]),
    [
      ...parts.filter((part) => !replacements.some((replacement) => replacement.id === part.id)),
      ...replacements,
    ],
    settings,
  );

void test("SSD limits apply per connector across positions and distinguish absent ports from missing data", () => {
  const restricted = withSpecs(board, { m2_slots: 1, storage_slots: 3 });
  assert.equal(
    ruleValue(checkParts([restricted], [line("storage-2", storage)]), "storage_capacity"),
    false,
  );
  const sata = component("sata-test", "storage", { interface: "SATA", connector: "SATA" });
  const hybrid = withSpecs(restricted, {
    sata_ports: 1,
    storage_interfaces: ["NVMe", "SATA"],
    storage_connectors: ["M.2", "SATA"],
  });
  const valid = checkParts([hybrid, sata], [line("storage-2", sata)]);
  assert.equal(ruleValue(valid, "storage_capacity"), true);
  assert.equal(ruleValue(valid, "storage_interface"), true);
  const noSata = checkParts([sata], [line("storage-2", sata)]);
  assert.equal(ruleValue(noSata, "storage_capacity"), false);
  assert.equal(ruleValue(noSata, "storage_interface"), false);
  const unknown = { ...hybrid, specs: { ...hybrid.specs } };
  delete unknown.specs.sata_ports;
  assert.equal(
    ruleValue(checkParts([unknown, sata], [line("storage-2", sata)]), "storage_capacity"),
    null,
  );
  const unverified = { ...storage, specs: {} };
  const incomplete = checkParts([unverified]);
  assert.equal(ruleValue(incomplete, "storage_interface"), null);
  assert.equal(ruleValue(incomplete, "storage_capacity"), null);
  assert.equal(incomplete.compatibility.pending, true);
});

void test("memory capacity counts gigabytes as well as modules and proven conflicts win over missing data", () => {
  const twoKits = [line("ram-2", ram)];
  assert.equal(ruleValue(checkParts([], twoKits), "ram_capacity"), true);
  assert.equal(
    ruleValue(checkParts([withSpecs(board, { max_ram_gb: 32 })], twoKits), "ram_capacity"),
    false,
  );
  const incomplete = { ...ram, specs: { type: "DDR5", sticks: 2 } };
  assert.equal(ruleValue(checkParts([incomplete]), "ram_capacity"), null);
  assert.equal(
    ruleValue(checkParts([incomplete, withSpecs(board, { ram_slots: 1 })]), "ram_capacity"),
    false,
  );
});

void test("cooler socket and height and PSU form factor are independent physical checks", () => {
  assert.equal(
    ruleValue(checkParts([withSpecs(cooler, { height_mm: 160 })]), "cooler_clearance"),
    true,
  );
  assert.equal(
    ruleValue(checkParts([withSpecs(cooler, { height_mm: 161 })]), "cooler_clearance"),
    false,
  );
  assert.equal(
    ruleValue(checkParts([withSpecs(cooler, { sockets: ["LGA1700"] })]), "cooler"),
    false,
  );
  assert.equal(ruleValue(checkParts([withSpecs(psu, { form_factor: "SFX" })]), "psu_case"), false);
  const unknown = { ...cooler, specs: { sockets: ["AM5"] } };
  assert.equal(ruleValue(checkParts([unknown]), "cooler_clearance"), null);
});

void test("optional fans do not block a build; selected fans consume shared and size-specific mounts", () => {
  assert.equal(checkParts().compatibility.pending, false);
  assert.ok(!checkParts().compatibility.rules.some((rule) => rule.id === "fan_size"));
  const fan120 = component("fan-120", "fan", { diameter_mm: 120 });
  const fan140 = component("fan-140", "fan", { diameter_mm: 140 });
  const valid = checkParts([fan120], [line("fan", fan120, 3)]);
  assert.equal(ruleValue(valid, "fan_capacity"), true);
  assert.equal(ruleValue(valid, "fan_size"), true);
  assert.equal(ruleValue(checkParts([fan140], [line("fan", fan140, 3)]), "fan_capacity"), false);
  const combined = checkParts([fan120, fan140], [line("fan", fan120, 3), line("fan-2", fan140, 2)]);
  assert.equal(ruleValue(combined, "fan_capacity"), false);
  const blocked = withSpecs(enclosure, { fan_mounts_120: 0 });
  assert.equal(
    ruleValue(checkParts([blocked, fan120], [line("fan", fan120)]), "fan_capacity"),
    false,
  );
  const unsupported = withSpecs(fan120, { diameter_mm: 200 });
  assert.equal(ruleValue(checkParts([unsupported], [line("fan", unsupported)]), "fan_size"), false);
  const unknown = { ...fan120, specs: {} };
  const missing = checkParts([unknown], [line("fan", unknown)]);
  assert.equal(ruleValue(missing, "fan_size"), null);
  assert.equal(ruleValue(missing, "fan_capacity"), null);
});

void test("required storage and cooling remain incomplete until selected; explicitly optional empty positions have no checks", () => {
  const base = fullLines.filter((line) => !["storage", "cooler"].includes(line.slot));
  const incomplete = evaluateBuild(build(base), parts, defaultSettings);
  assert.equal(incomplete.complete, false);
  assert.deepEqual(incomplete.missingRequiredSlots, ["storage", "cooler"]);
  assert.equal(incomplete.compatibility.pending, true);
  const optional = resolveSettings({
    global: {
      slots: defaultSettings.global.slots.map((slot) =>
        ["storage", "cooler"].includes(slot.category) ? { ...slot, required: false } : slot,
      ),
    },
  });
  const complete = evaluateBuild(build(base), parts, optional);
  assert.equal(complete.complete, true);
  assert.equal(complete.compatibility.pending, false);
  assert.ok(
    !complete.compatibility.rules.some(
      (rule) => rule.id.startsWith("cooler") || rule.id.startsWith("storage"),
    ),
  );
});

void test("PSU estimate includes the configured system allowance before headroom and rounding", () => {
  const normal = checkParts();
  assert.equal(normal.compatibility.tdp, 365);
  assert.equal(normal.compatibility.recommended, 550);
  const settings = resolveSettings({
    global: { systemPowerAllowanceWatts: 200, psuHeadroomBasisPoints: 0 },
  });
  const larger = checkParts([], [], settings);
  assert.equal(larger.compatibility.tdp, 465);
  assert.equal(larger.compatibility.recommended, 500);
  assert.equal(
    ruleValue(checkParts([withSpecs(psu, { wattage: 499 })], [], settings), "psu"),
    false,
  );
});

void test("technical contracts reject malformed counts, dimensions and support lists while preserving unknown fields", () => {
  for (const specs of [
    { ram_slots: 1.5 },
    { fan_slots: -1 },
    { fan_mounts_120: "2" },
    { sticks: 1.5 },
    { size_gb: 1.1 },
    { height_mm: 0 },
    { sockets: [true] },
    { interface: 3 },
    { fan_sizes_mm: ["120"] },
  ])
    assert.throws(() => ComponentSchema.parse({ ...board, specs }));
  assert.doesNotThrow(() =>
    ComponentSchema.parse({
      ...board,
      specs: { m2_slots: 0, sata_ports: 0, sockets: [], future_attribute: "example" },
    }),
  );
});

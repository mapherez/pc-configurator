import { z } from "zod";
import defaults from "./settings/default.json" with { type: "json" };
import pt from "./settings/markets/pt.json" with { type: "json" };
import us from "./settings/markets/us.json" with { type: "json" };
import portuguese from "./locales/pt-PT.json" with { type: "json" };
import english from "./locales/en-US.json" with { type: "json" };

export const categories = [
  "cpu",
  "motherboard",
  "ram",
  "gpu",
  "psu",
  "case",
  "storage",
  "cooler",
  "fan",
] as const;
export const CategorySchema = z.enum(categories);
export type Category = z.infer<typeof CategorySchema>;
export const LanguageSchema = z.enum(["pt-PT", "en-US"]);
export type Language = z.infer<typeof LanguageSchema>;
export const Identifier = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const minor = z.number().int().nonnegative().max(100_000_000);
const scalar = z.union([z.string(), z.number().finite(), z.boolean()]);
export const OfferSchema = z
  .object({
    market: Identifier,
    currency: z.string().regex(/^[A-Z]{3}$/),
    netMinor: minor,
    available: z.boolean(),
  })
  .strict();
export const ComponentSchema = z
  .object({
    id: Identifier,
    productId: Identifier.optional(),
    variant: z.record(z.string(), z.string()).default({}),
    sku: z.string().trim().max(120),
    name: z.string().trim().min(1).max(240),
    brand: z.string().trim().min(1).max(120),
    category: CategorySchema,
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    images: z.array(z.string().max(2048)).max(20).default([]),
    specs: z.record(z.string(), z.union([scalar, z.array(scalar)])).default({}),
    offers: z.array(OfferSchema).max(100).default([]),
    visual: z.object({ assetId: Identifier, anchor: Identifier }).strict().optional(),
  })
  .strict()
  .superRefine((part, ctx) => {
    if (new Set(part.offers.map((offer) => offer.market)).size !== part.offers.length) {
      ctx.addIssue({ code: "custom", path: ["offers"], message: "duplicate_market_offer" });
    }
    const positive = [
      "tdp",
      "length_mm",
      "max_gpu_length_mm",
      "wattage",
      "size_gb",
      "sticks",
      "max_ram_gb",
      "height_mm",
      "max_cpu_cooler_height_mm",
      "diameter_mm",
    ];
    const counts = ["ram_slots", "storage_slots", "m2_slots", "sata_ports", "fan_slots"];
    const integers = ["size_gb", "sticks", "max_ram_gb", "diameter_mm"];
    const texts = ["socket", "ram_type", "form_factor", "type", "interface", "connector"];
    const lists = [
      "mobo_support",
      "sockets",
      "storage_interfaces",
      "storage_connectors",
      "psu_support",
    ];
    for (const [key, value] of Object.entries(part.specs)) {
      const count = counts.includes(key) || /^fan_mounts_\d+$/.test(key);
      const invalid =
        ((positive.includes(key) || count) &&
          (typeof value !== "number" ||
            !Number.isFinite(value) ||
            (count ? value < 0 : value <= 0) ||
            ((count || integers.includes(key)) && !Number.isSafeInteger(value)))) ||
        (texts.includes(key) && (typeof value !== "string" || !value.trim())) ||
        (lists.includes(key) &&
          (!Array.isArray(value) ||
            !value.every((item) => typeof item === "string" && item.trim()))) ||
        (key === "fan_sizes_mm" &&
          (!Array.isArray(value) ||
            !value.every(
              (item) => typeof item === "number" && Number.isSafeInteger(item) && item > 0,
            )));
      if (invalid)
        ctx.addIssue({ code: "custom", path: ["specs", key], message: "invalid_specification" });
    }
  });
export type Component = z.output<typeof ComponentSchema>;
export type ComponentInput = z.input<typeof ComponentSchema>;
export const SlotSchema = z
  .object({
    id: Identifier,
    category: CategorySchema,
    required: z.boolean(),
    maxQuantity: z.number().int().min(1).max(16),
  })
  .strict();
const FeaturesSchema = z
  .object({ priceFilter: z.boolean(), compatibilityFilter: z.boolean(), exampleBuild: z.boolean() })
  .strict();
const PowerAllowanceSchema = z.number().int().min(0).max(2000);
const GlobalSchema = z
  .object({
    defaultMarket: Identifier,
    defaultLanguage: LanguageSchema,
    languages: z.array(LanguageSchema).min(1),
    features: FeaturesSchema,
    psuHeadroomBasisPoints: z.number().int().min(0).max(20000),
    systemPowerAllowanceWatts: PowerAllowanceSchema.default(100),
    slots: z.array(SlotSchema).min(1).max(64),
  })
  .strict();
const TextKeySchema = z.enum(
  Object.keys(portuguese) as [keyof typeof portuguese, ...(keyof typeof portuguese)[]],
);
export const MarketSchema = z
  .object({
    nameKey: TextKeySchema,
    features: FeaturesSchema.partial().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    minorDigits: z.number().int().min(0).max(3),
    taxBasisPoints: z.number().int().min(0).max(10000).nullable(),
  })
  .strict();
export const SettingsSchema = z
  .object({ global: GlobalSchema, markets: z.record(Identifier, MarketSchema) })
  .strict()
  .superRefine((settings, ctx) => {
    if (
      !Object.hasOwn(settings.markets, settings.global.defaultMarket) ||
      !settings.global.languages.includes(settings.global.defaultLanguage)
    )
      ctx.addIssue({ code: "custom", message: "invalid_defaults" });
    if (new Set(settings.global.slots.map((slot) => slot.id)).size !== settings.global.slots.length)
      ctx.addIssue({ code: "custom", message: "duplicate_slots" });
  });
export type Settings = z.output<typeof SettingsSchema>;
export function marketFeatures(settings: Settings, market: string) {
  return { ...settings.global.features, ...settings.markets[market]?.features };
}
export const SettingsPatchSchema = z
  .object({
    global: GlobalSchema.partial()
      .extend({
        features: FeaturesSchema.partial().optional(),
        systemPowerAllowanceWatts: PowerAllowanceSchema.optional(),
      })
      .optional(),
    markets: z.record(Identifier, MarketSchema.partial()).optional(),
  })
  .strict();
export type SettingsPatch = z.input<typeof SettingsPatchSchema>;
// Objects merge, arrays replace, and explicit null is preserved (unknown tax is not zero).
export function mergeSettings(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const merged: Record<string, unknown> = { ...(base && typeof base === "object" ? base : {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("invalid_setting_key");
    merged[key] =
      value && typeof value === "object" && !Array.isArray(value)
        ? mergeSettings(merged[key], value)
        : value;
  }
  return merged;
}
export function resolveSettings(input: unknown = {}): Settings {
  const patch = SettingsPatchSchema.parse(input);
  return SettingsSchema.parse(mergeSettings({ global: defaults, markets: { pt, us } }, patch));
}
export const defaultSettings = resolveSettings();
export type TextKey = keyof typeof portuguese;
export const dictionaries = { "pt-PT": portuguese, "en-US": english };
export function translate(
  language: Language,
  key: TextKey,
  params: Record<string, string | number> = {},
  overrides?: LocaleOverrides,
) {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    overrides?.[language]?.[key] ?? dictionaries[language][key],
  );
}
export const BuildLineSchema = z
  .object({
    slot: Identifier,
    componentId: Identifier,
    quantity: z.number().int().min(1).max(16).default(1),
  })
  .strict();
export const BuildSchema = z
  .object({
    version: z.literal(1),
    market: Identifier,
    language: LanguageSchema,
    lines: z.array(BuildLineSchema).max(64),
  })
  .strict()
  .superRefine((build, ctx) => {
    if (new Set(build.lines.map((line) => line.slot)).size !== build.lines.length)
      ctx.addIssue({ code: "custom", message: "duplicate_build_slot" });
  });
export type Build = z.output<typeof BuildSchema>;
export type BuildLine = z.output<typeof BuildLineSchema>;
export type Money = { net: number; tax: number; gross: number };
export function price(
  component: Component,
  market: string,
  settings: Settings,
  quantity = 1,
): Money | null {
  const config = settings.markets[market];
  const offer = component.offers.find((entry) => entry.market === market);
  if (
    !config ||
    config.taxBasisPoints === null ||
    !offer?.available ||
    offer.currency !== config.currency ||
    component.status !== "published"
  )
    return null;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 16)
    throw new Error("invalid_quantity");
  const net = offer.netMinor * quantity;
  const tax = Number((BigInt(net) * BigInt(config.taxBasisPoints) + 5000n) / 10000n);
  return { net, tax, gross: net + tax };
}
export type RuleId =
  | "cpu"
  | "ram"
  | "gpu"
  | "case"
  | "psu"
  | "psu_case"
  | "ram_capacity"
  | "storage_capacity"
  | "storage_interface"
  | "cooler"
  | "cooler_clearance"
  | "fan_size"
  | "fan_capacity";
export type Rule = { id: RuleId; ok: boolean | null; categories: readonly Category[] };
export type ResolvedLine = BuildLine & { component: Component };
function numberSpec(part: Component | undefined, key: string, allowZero = false): number | null {
  const value = part?.specs[key];
  return typeof value === "number" && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
    ? value
    : null;
}
function textSpec(part: Component | undefined, key: string): string | null {
  const value = part?.specs[key];
  return typeof value === "string" && value.trim() ? value : null;
}
function textListSpec(part: Component | undefined, key: string): string[] | null {
  const value = part?.specs[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim())
    ? (value as string[])
    : null;
}
// A proven conflict wins even when other checks lack data.
function allChecks(checks: (boolean | null)[]): boolean | null {
  return checks.includes(false)
    ? false
    : checks.length && checks.every((check) => check === true)
      ? true
      : null;
}
const atMost = (value: number | null, limit: number | null) =>
  value !== null && limit !== null ? value <= limit : null;
const supports = (values: readonly (string | number)[] | null, value: string | number | null) =>
  values !== null && value !== null ? values.includes(value) : null;
export function compatibility(lines: ResolvedLine[], settings: Settings) {
  const of = (category: Category) => lines.filter((line) => line.component.category === category);
  const first = (category: Category) => of(category)[0]?.component;
  const active = (category: Category) =>
    of(category).length > 0 ||
    settings.global.slots.some((slot) => slot.category === category && slot.required);
  const cpu = first("cpu"),
    board = first("motherboard"),
    gpu = first("gpu"),
    enclosure = first("case"),
    psu = first("psu");
  const compare = (a: string | null, b: string | null) =>
    a !== null && b !== null ? a === b : null;
  const cpuPower = numberSpec(cpu, "tdp"),
    gpuPower = numberSpec(gpu, "tdp"),
    watts = numberSpec(psu, "wattage");
  // Configurable system allowance covers the remaining parts; this is an estimate, not a measurement.
  const tdp =
    cpuPower !== null && gpuPower !== null
      ? cpuPower + gpuPower + settings.global.systemPowerAllowanceWatts
      : null;
  const recommended =
    tdp === null
      ? null
      : Math.ceil((tdp * (1 + settings.global.psuHeadroomBasisPoints / 10000)) / 50) * 50;
  const rams = of("ram"),
    storage = of("storage"),
    fans = of("fan");
  const sumSpec = (entries: ResolvedLine[], key: string) => {
    const values = entries.map((line) => {
      const n = numberSpec(line.component, key);
      return n === null ? null : n * line.quantity;
    });
    return values.length && values.every((n) => n !== null)
      ? values.reduce<number>((sum, n) => sum + n!, 0)
      : null;
  };
  const totalQuantity = (entries: ResolvedLine[]) =>
    entries.reduce((sum, line) => sum + line.quantity, 0);
  const storageCapacity: (boolean | null)[] = [
    storage.length
      ? atMost(totalQuantity(storage), numberSpec(board, "storage_slots", true))
      : null,
  ];
  for (const [connector, key] of [
    ["M.2", "m2_slots"],
    ["SATA", "sata_ports"],
  ]) {
    const matching = storage.filter((line) => textSpec(line.component, "connector") === connector);
    if (matching.length)
      storageCapacity.push(atMost(totalQuantity(matching), numberSpec(board, key, true)));
  }
  if (
    storage.some((line) => !["M.2", "SATA"].includes(textSpec(line.component, "connector") ?? ""))
  )
    storageCapacity.push(null);
  const fanSizes = enclosure?.specs.fan_sizes_mm;
  const supportedFanSizes =
    Array.isArray(fanSizes) && fanSizes.every((value) => typeof value === "number" && value > 0)
      ? (fanSizes as number[])
      : null;
  const fanCapacity: (boolean | null)[] = [
    fans.length ? atMost(totalQuantity(fans), numberSpec(enclosure, "fan_slots", true)) : null,
  ];
  const diameters = new Set(fans.map((line) => numberSpec(line.component, "diameter_mm")));
  for (const diameter of diameters) {
    const matching = fans.filter((line) => numberSpec(line.component, "diameter_mm") === diameter);
    fanCapacity.push(
      diameter === null
        ? null
        : atMost(totalQuantity(matching), numberSpec(enclosure, `fan_mounts_${diameter}`, true)),
    );
  }
  const cooler = first("cooler");
  const rules: Rule[] = [
    {
      id: "cpu",
      categories: ["cpu", "motherboard"],
      ok: compare(textSpec(cpu, "socket"), textSpec(board, "socket")),
    },
    {
      id: "ram",
      categories: ["ram", "motherboard"],
      ok: allChecks(
        rams.map((line) => compare(textSpec(line.component, "type"), textSpec(board, "ram_type"))),
      ),
    },
    {
      id: "gpu",
      categories: ["gpu", "case"],
      ok: atMost(numberSpec(gpu, "length_mm"), numberSpec(enclosure, "max_gpu_length_mm")),
    },
    {
      id: "case",
      categories: ["motherboard", "case"],
      ok: supports(textListSpec(enclosure, "mobo_support"), textSpec(board, "form_factor")),
    },
    { id: "psu", categories: ["cpu", "gpu", "psu"], ok: atMost(recommended, watts) },
    {
      id: "psu_case",
      categories: ["psu", "case"],
      ok: supports(textListSpec(enclosure, "psu_support"), textSpec(psu, "form_factor")),
    },
    {
      id: "ram_capacity",
      categories: ["ram", "motherboard"],
      ok: allChecks([
        atMost(sumSpec(rams, "sticks"), numberSpec(board, "ram_slots", true)),
        atMost(sumSpec(rams, "size_gb"), numberSpec(board, "max_ram_gb", true)),
      ]),
    },
  ];
  if (active("storage"))
    rules.push(
      {
        id: "storage_capacity",
        categories: ["storage", "motherboard"],
        ok: allChecks(storageCapacity),
      },
      {
        id: "storage_interface",
        categories: ["storage", "motherboard"],
        ok: allChecks(
          storage.flatMap((line) => [
            supports(
              textListSpec(board, "storage_interfaces"),
              textSpec(line.component, "interface"),
            ),
            supports(
              textListSpec(board, "storage_connectors"),
              textSpec(line.component, "connector"),
            ),
          ]),
        ),
      },
    );
  if (active("cooler"))
    rules.push(
      {
        id: "cooler",
        categories: ["cpu", "cooler"],
        ok: supports(textListSpec(cooler, "sockets"), textSpec(cpu, "socket")),
      },
      {
        id: "cooler_clearance",
        categories: ["cooler", "case"],
        ok: atMost(
          numberSpec(cooler, "height_mm"),
          numberSpec(enclosure, "max_cpu_cooler_height_mm"),
        ),
      },
    );
  if (active("fan"))
    rules.push(
      {
        id: "fan_size",
        categories: ["fan", "case"],
        ok: allChecks(
          fans.map((line) =>
            supports(supportedFanSizes, numberSpec(line.component, "diameter_mm")),
          ),
        ),
      },
      { id: "fan_capacity", categories: ["fan", "case"], ok: allChecks(fanCapacity) },
    );
  return {
    rules,
    conflicts: rules.some((rule) => rule.ok === false),
    pending: rules.some((rule) => rule.ok === null),
    tdp,
    recommended,
  };
}
export function evaluateBuild(input: Build, components: Component[], settings: Settings) {
  const build = BuildSchema.parse(input);
  if (
    !Object.hasOwn(settings.markets, build.market) ||
    !settings.global.languages.includes(build.language)
  )
    throw new Error("invalid_build_preferences");
  const issues: {
    slot: string;
    code:
      | "unknown_slot"
      | "missing_component"
      | "wrong_category"
      | "invalid_quantity"
      | "price_unavailable";
  }[] = [];
  const resolved: ResolvedLine[] = [];
  for (const line of build.lines) {
    const slot = settings.global.slots.find((entry) => entry.id === line.slot);
    const part = components.find(
      (entry) => entry.id === line.componentId && entry.status === "published",
    );
    const code = !slot
      ? "unknown_slot"
      : !part
        ? "missing_component"
        : part.category !== slot.category
          ? "wrong_category"
          : line.quantity > slot.maxQuantity
            ? "invalid_quantity"
            : null;
    if (code) {
      issues.push({ slot: line.slot, code });
      continue;
    }
    resolved.push({ ...line, component: part! });
  }
  const lines = resolved.map((line) => {
    const amount = price(line.component, build.market, settings, line.quantity);
    if (!amount) issues.push({ slot: line.slot, code: "price_unavailable" });
    return { slot: line.slot, componentId: line.componentId, quantity: line.quantity, amount };
  });
  const total =
    issues.length || settings.markets[build.market].taxBasisPoints === null
      ? null
      : lines.reduce<Money>(
          (sum, line) => ({
            net: sum.net + line.amount!.net,
            tax: sum.tax + line.amount!.tax,
            gross: sum.gross + line.amount!.gross,
          }),
          { net: 0, tax: 0, gross: 0 },
        );
  const checks = compatibility(resolved, settings);
  const missingRequiredSlots = settings.global.slots
    .filter((slot) => slot.required && !resolved.some((line) => line.slot === slot.id))
    .map((slot) => slot.id);
  return {
    lines,
    total,
    issues,
    compatibility: {
      ...checks,
      pending:
        checks.pending ||
        missingRequiredSlots.length > 0 ||
        issues.some((issue) => issue.code !== "price_unavailable"),
    },
    missingRequiredSlots,
    complete: missingRequiredSlots.length === 0,
  };
}
const LocaleKeySchema = TextKeySchema;
export const LocaleValuesSchema = z
  .partialRecord(LocaleKeySchema, z.string().min(1).max(4000))
  .superRefine((values, ctx) => {
    for (const [key, value] of Object.entries(values)) {
      const placeholders = (text: string) =>
        [...text.matchAll(/{{(.*?)}}/g)]
          .map((match) => match[1])
          .sort((a, b) => a.localeCompare(b));
      if (
        JSON.stringify(placeholders(value!)) !==
        JSON.stringify(placeholders(portuguese[key as TextKey]))
      )
        ctx.addIssue({ code: "custom", path: [key], message: "invalid_placeholders" });
    }
  });
export const LocaleOverridesSchema = z.partialRecord(LanguageSchema, LocaleValuesSchema);
export type LocaleOverrides = z.infer<typeof LocaleOverridesSchema>;
export function parseMoney(input: string, digits: number): number | null {
  if (
    !Number.isInteger(digits) ||
    digits < 0 ||
    digits > 3 ||
    !new RegExp(`^\\d+(?:[.,]\\d{1,${Math.max(1, digits)}})?$`).test(input.trim())
  )
    return null;
  const [whole, fraction = ""] = input.trim().replace(",", ".").split(".");
  if (fraction.length > digits) return null;
  const amount =
    BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, "0") || "0");
  return amount <= 100000000n ? Number(amount) : null;
}
export const SnapshotSchema = z
  .object({
    settings: SettingsSchema,
    components: z.array(ComponentSchema),
    locales: LocaleOverridesSchema.optional(),
  })
  .strict()
  .superRefine((snapshot, ctx) => {
    if (
      snapshot.components.some((part) => part.status !== "published") ||
      new Set(snapshot.components.map((part) => part.id)).size !== snapshot.components.length
    )
      ctx.addIssue({ code: "custom", message: "invalid_public_catalogue" });
  });
export type Snapshot = z.output<typeof SnapshotSchema>;

export const RoleSchema = z.enum(["unassigned", "viewer", "editor", "publisher", "owner"]);
export const PublicActorSchema = z.object({
  issuer: z.string(),
  subject: z.string(),
  email: z.string(),
  name: z.string(),
  role: RoleSchema,
  scopes: z.array(z.string()),
});
export const AdminSessionSchema = z.object({
  configured: z.boolean(),
  actor: PublicActorSchema.nullable(),
  csrf: z.string().optional(),
});
export type AdminSession = z.infer<typeof AdminSessionSchema>;
export const AdminDocumentSchema = z.object({
  kind: z.enum(["component", "settings", "locale"]),
  id: z.string(),
  revision: z.number().int(),
  draft: z.unknown(),
  published_revision: z.number().int(),
});
export type AdminDocument = z.infer<typeof AdminDocumentSchema>;
export const AssetSchema = z.object({
  id: Identifier,
  filename: z.string(),
  content_type: z.string(),
  bytes: z.number().int(),
  checksum: z.string(),
  created: z.string(),
});
export type Asset = z.infer<typeof AssetSchema>;
export const AdminStateSchema = z.object({
  snapshot: SnapshotSchema,
  components: z.array(ComponentSchema),
  documents: z.array(AdminDocumentSchema),
  assets: z.array(AssetSchema),
});
export type AdminState = z.infer<typeof AdminStateSchema>;

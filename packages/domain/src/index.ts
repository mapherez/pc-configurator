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
    for (const [key, value] of Object.entries(part.specs)) {
      if (
        [
          "tdp",
          "length_mm",
          "max_gpu_length_mm",
          "wattage",
          "size_gb",
          "sticks",
          "ram_slots",
          "storage_slots",
        ].includes(key) &&
        (typeof value !== "number" || value <= 0 || !Number.isFinite(value))
      ) {
        ctx.addIssue({ code: "custom", path: ["specs", key], message: "invalid_specification" });
      }
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
const GlobalSchema = z
  .object({
    defaultMarket: Identifier,
    defaultLanguage: LanguageSchema,
    languages: z.array(LanguageSchema).min(1),
    features: FeaturesSchema,
    psuHeadroomBasisPoints: z.number().int().min(0).max(20000),
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
      .extend({ features: FeaturesSchema.partial().optional() })
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
  | "ram_capacity"
  | "storage_capacity"
  | "cooler";
export type Rule = { id: RuleId; ok: boolean | null; categories: readonly Category[] };
export type ResolvedLine = BuildLine & { component: Component };
function numberSpec(part: Component | undefined, key: string): number | null {
  const value = part?.specs[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
function textSpec(part: Component | undefined, key: string): string | null {
  const value = part?.specs[key];
  return typeof value === "string" && value.trim() ? value : null;
}
export function compatibility(lines: ResolvedLine[], settings: Settings) {
  const of = (category: Category) => lines.filter((line) => line.component.category === category);
  const first = (category: Category) => of(category)[0]?.component;
  const cpu = first("cpu"),
    board = first("motherboard"),
    gpu = first("gpu"),
    enclosure = first("case"),
    psu = first("psu");
  const compare = (a: string | number | null, b: string | number | null) =>
    a !== null && b !== null ? a === b : null;
  const supported = enclosure?.specs.mobo_support;
  const form = textSpec(board, "form_factor");
  const gpuLength = numberSpec(gpu, "length_mm"),
    clearance = numberSpec(enclosure, "max_gpu_length_mm");
  const cpuPower = numberSpec(cpu, "tdp"),
    gpuPower = numberSpec(gpu, "tdp"),
    watts = numberSpec(psu, "wattage");
  const tdp = cpuPower !== null && gpuPower !== null ? cpuPower + gpuPower : null;
  const recommended =
    tdp === null
      ? null
      : Math.ceil((tdp * (1 + settings.global.psuHeadroomBasisPoints / 10000)) / 50) * 50;
  const rams = of("ram");
  const ramChecks = rams.map((line) =>
    compare(textSpec(line.component, "type"), textSpec(board, "ram_type")),
  );
  const ramSlots = numberSpec(board, "ram_slots");
  const sticks = rams.map((line) => {
    const n = numberSpec(line.component, "sticks");
    return n === null ? null : n * line.quantity;
  });
  const storage = of("storage");
  const storageSlots = numberSpec(board, "storage_slots");
  const cooler = first("cooler");
  const coolerSockets = cooler?.specs.sockets;
  const socket = textSpec(cpu, "socket");
  const rules: Rule[] = [
    {
      id: "cpu",
      categories: ["cpu", "motherboard"],
      ok: compare(textSpec(cpu, "socket"), textSpec(board, "socket")),
    },
    {
      id: "ram",
      categories: ["ram", "motherboard"],
      ok: ramChecks.includes(false)
        ? false
        : ramChecks.length && ramChecks.every((check) => check === true)
          ? true
          : null,
    },
    {
      id: "gpu",
      categories: ["gpu", "case"],
      ok: gpuLength !== null && clearance !== null ? gpuLength <= clearance : null,
    },
    {
      id: "case",
      categories: ["motherboard", "case"],
      ok:
        form &&
        Array.isArray(supported) &&
        supported.length > 0 &&
        supported.every((item) => typeof item === "string")
          ? supported.includes(form)
          : null,
    },
    {
      id: "psu",
      categories: ["cpu", "gpu", "psu"],
      ok: recommended !== null && watts !== null ? watts >= recommended : null,
    },
    {
      id: "ram_capacity",
      categories: ["ram", "motherboard"],
      ok:
        ramSlots !== null && sticks.length && sticks.every((n) => n !== null)
          ? sticks.reduce<number>((sum, n) => sum + n!, 0) <= ramSlots
          : null,
    },
    {
      id: "storage_capacity",
      categories: ["storage", "motherboard"],
      ok:
        storage.length && storageSlots !== null
          ? storage.reduce((sum, line) => sum + line.quantity, 0) <= storageSlots
          : null,
    },
    {
      id: "cooler",
      categories: ["cpu", "cooler"],
      ok:
        socket && Array.isArray(coolerSockets) && coolerSockets.length > 0
          ? coolerSockets.includes(socket)
          : null,
    },
  ];
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
  return {
    lines,
    total,
    issues,
    compatibility: {
      ...checks,
      pending: checks.pending || issues.some((issue) => issue.code !== "price_unavailable"),
    },
    complete: settings.global.slots
      .filter((slot) => slot.required)
      .every((slot) => resolved.some((line) => line.slot === slot.id)),
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

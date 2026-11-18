import cpu from "../../../server/prisma/data/cpu.json";
import motherboard from "../../../server/prisma/data/motherboard.json";
import ram from "../../../server/prisma/data/ram.json";
import gpu from "../../../server/prisma/data/gpu.json";
import psu from "../../../server/prisma/data/psu.json";
import cases from "../../../server/prisma/data/case.json";
import marketSettings from "../../settings/prototype/markets.json";
import portuguese from "../../settings/prototype/locale/pt-PT.json";
import english from "../../settings/prototype/locale/en-US.json";
import { PartBase, type Part } from "../modules/catalog/schema";
import {
  extractSpecs,
  isCpuMoboCompatible,
  isRamMoboCompatible,
  isGpuCaseCompatible,
  isMoboCaseCompatible,
  isPsuWattageSufficient,
  recommendedPsuWattage,
  type SpecsBag,
} from "../modules/build/compatibility";

export const categories = ["cpu", "motherboard", "ram", "gpu", "psu", "case"] as const;
export type Category = (typeof categories)[number];
export type Market = keyof typeof marketSettings;
export type Language = "pt-PT" | "en-US";
export type Selection = Partial<Record<Category, string>>;
export type State = { market: Market; language: Language; selected: Selection };
export type TextKey = keyof typeof portuguese;
export const markets = marketSettings;
export const catalog = [...cpu, ...motherboard, ...ram, ...gpu, ...psu, ...cases].map((part) =>
  PartBase.parse(part),
);
export const sample: Selection = {
  cpu: "cpu-7600",
  motherboard: "mobo-b650-atx",
  ram: "ram-ddr5-32-2x16",
  gpu: "gpu-rtx4070s",
  psu: "psu-750-gold",
  case: "case-mesh-atx",
};
export const initialState: State = { market: "pt", language: "pt-PT", selected: {} };
export const storageKey = "pc-configurator:prototype:v1";

export function translate(
  language: Language,
  key: TextKey,
  params: Record<string, string | number> = {},
) {
  const dictionary = language === "en-US" ? english : portuguese;
  return Object.entries(params).reduce(
    (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)),
    dictionary[key],
  );
}

export function selectedParts(selection: Selection): Part[] {
  return categories.flatMap((category) => {
    const part = catalog.find(
      (candidate) => candidate.category === category && candidate.id === selection[category],
    );
    return part ? [part] : [];
  });
}

export function price(part: Part, market: Market) {
  const settings = markets[market];
  if (!settings.hasPrices || settings.taxBasisPoints === null) return null;
  const net = Math.round(part.price * 100);
  const tax = Math.round((net * settings.taxBasisPoints) / 10000);
  return { net, tax, gross: net + tax };
}

export function totals(parts: Part[], market: Market) {
  if (!markets[market].hasPrices || markets[market].taxBasisPoints === null) return null;
  return parts.reduce(
    (sum, part) => {
      const line = price(part, market)!;
      return { net: sum.net + line.net, tax: sum.tax + line.tax, gross: sum.gross + line.gross };
    },
    { net: 0, tax: 0, gross: 0 },
  );
}

export type RuleId = "cpu" | "ram" | "gpu" | "case" | "psu";
export type Rule = { id: RuleId; ok: boolean | null; categories: readonly Category[] };
export function compatibility(selection: Selection) {
  const specs: SpecsBag = {};
  for (const part of selectedParts(selection)) Object.assign(specs, extractSpecs(part));
  const rules: Rule[] = [
    {
      id: "cpu",
      categories: ["cpu", "motherboard"],
      ok: specs.cpu && specs.mobo ? isCpuMoboCompatible(specs.cpu, specs.mobo) : null,
    },
    {
      id: "ram",
      categories: ["ram", "motherboard"],
      ok: specs.ramType && specs.mobo ? isRamMoboCompatible(specs.ramType, specs.mobo) : null,
    },
    {
      id: "gpu",
      categories: ["gpu", "case"],
      ok: specs.gpu && specs.case ? isGpuCaseCompatible(specs.gpu, specs.case) : null,
    },
    {
      id: "case",
      categories: ["motherboard", "case"],
      ok: specs.mobo && specs.case ? isMoboCaseCompatible(specs.mobo, specs.case) : null,
    },
    {
      id: "psu",
      categories: ["cpu", "gpu", "psu"],
      ok: specs.psu && specs.cpu && specs.gpu ? isPsuWattageSufficient(specs) : null,
    },
  ];
  return {
    rules,
    conflicts: rules.some((rule) => rule.ok === false),
    pending: rules.some((rule) => rule.ok === null),
    tdp: (specs.cpu?.tdp ?? 0) + (specs.gpu?.tdp ?? 0),
    recommended: recommendedPsuWattage(specs),
  };
}

export function candidateConflicts(part: Part, selected: Selection) {
  return compatibility({ ...selected, [part.category]: part.id }).rules.some(
    (rule) => rule.ok === false && rule.categories.includes(part.category as Category),
  );
}

export function restoreState(input: unknown): State {
  if (!input || typeof input !== "object") return structuredClone(initialState);
  const value = input as Record<string, unknown>;
  const selected: Selection = {};
  const source =
    value.selected && typeof value.selected === "object"
      ? (value.selected as Record<string, unknown>)
      : {};
  for (const category of categories) {
    const id = source[category];
    if (catalog.some((part) => part.category === category && part.id === id))
      selected[category] = id as string;
  }
  return {
    market: value.market === "us" ? "us" : "pt",
    language: value.language === "en-US" ? "en-US" : "pt-PT",
    selected,
  };
}

export function stateFromUrl(href: string): State | null {
  const params = new URL(href).searchParams;
  if (![...categories, "market", "locale"].some((key) => params.has(key))) return null;
  return restoreState({
    market: params.get("market"),
    language: params.get("locale"),
    selected: Object.fromEntries(categories.map((category) => [category, params.get(category)])),
  });
}

export function shareUrl(state: State, href: string) {
  const url = new URL(href);
  url.searchParams.set("market", state.market);
  url.searchParams.set("locale", state.language);
  for (const category of categories) {
    url.searchParams.delete(category);
    const id = state.selected[category];
    if (id) url.searchParams.set(category, id);
  }
  return url.toString();
}

import {
  categories,
  defaultSettings,
  evaluateBuild,
  Identifier,
  price as priceComponent,
  type Build,
  type Category,
  type Component,
  type Settings,
  type Snapshot,
} from "@pc-configurator/domain";
export { categories, translate } from "@pc-configurator/domain";
export type { Category, Language, TextKey } from "@pc-configurator/domain";
export type Market = string;
export type Selection = Partial<Record<string, string>>;
export type State = {
  market: string;
  language: "pt-PT" | "en-US";
  selected: Selection;
  quantities: Record<string, number>;
};
export const initialState: State = {
  market: defaultSettings.global.defaultMarket,
  language: defaultSettings.global.defaultLanguage,
  selected: {},
  quantities: {},
};
export const storageKey = "pc-configurator:build:v2";
export const previousStorageKey = "pc-configurator:prototype:v1";
export const sample: Selection = {
  cpu: "cpu-7600",
  motherboard: "mobo-b650-atx",
  ram: "ram-ddr5-32-2x16",
  gpu: "gpu-rtx4070s",
  psu: "psu-750-gold",
  case: "case-mesh-atx",
  storage: "ssd-demo-nvme-1tb",
  cooler: "cooler-demo-tower-155",
  fan: "fan-demo-120",
};
export function toBuild(state: State): Build {
  return {
    version: 1,
    market: state.market,
    language: state.language,
    lines: Object.entries(state.selected).flatMap(([slot, componentId]) =>
      componentId ? [{ slot, componentId, quantity: state.quantities[slot] ?? 1 }] : [],
    ),
  };
}
export function restoreState(input: unknown, settings: Settings = defaultSettings): State {
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const selected: Selection = {},
    quantities: Record<string, number> = {};
  const source =
    value.selected && typeof value.selected === "object"
      ? (value.selected as Record<string, unknown>)
      : {};
  const amounts =
    value.quantities && typeof value.quantities === "object"
      ? (value.quantities as Record<string, unknown>)
      : {};
  // Preserve valid references even when a component/slot is no longer published.
  for (const [slot, id] of Object.entries(source).slice(0, 64)) {
    if (Identifier.safeParse(slot).success && Identifier.safeParse(id).success) {
      selected[slot] = id as string;
      const quantity = Number(amounts[slot] ?? 1);
      quantities[slot] =
        Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 16 ? quantity : 1;
    }
  }
  const language =
    value.language === "en-US"
      ? "en-US"
      : value.language === "pt-PT"
        ? "pt-PT"
        : settings.global.defaultLanguage;
  return {
    market:
      typeof value.market === "string" && Object.hasOwn(settings.markets, value.market)
        ? value.market
        : settings.global.defaultMarket,
    language: settings.global.languages.includes(language)
      ? language
      : settings.global.defaultLanguage,
    selected,
    quantities,
  };
}
export function stateFromUrl(href: string, settings: Settings = defaultSettings): State | null {
  const params = new URL(href).searchParams;
  const slots = new Set([...settings.global.slots.map((slot) => slot.id), ...categories]);
  if (![...slots, "market", "locale", "build"].some((key) => params.has(key))) return null;
  if (params.has("build")) {
    try {
      return restoreState(JSON.parse(params.get("build")!), settings);
    } catch {
      /* Read readable links as fallback. */
    }
  }
  return restoreState(
    {
      market: params.get("market"),
      language: params.get("locale"),
      selected: Object.fromEntries(
        [...slots].filter((slot) => params.has(slot)).map((slot) => [slot, params.get(slot)]),
      ),
      quantities: Object.fromEntries(
        [...slots].map((slot) => [slot, params.get(`qty.${slot}`) ?? 1]),
      ),
    },
    settings,
  );
}
export function shareUrl(state: State, href: string) {
  const url = new URL(href);
  url.search = "";
  url.searchParams.set("market", state.market);
  url.searchParams.set("locale", state.language);
  for (const [slot, id] of Object.entries(state.selected))
    if (id) {
      url.searchParams.set(slot, id);
      if ((state.quantities[slot] ?? 1) !== 1)
        url.searchParams.set(`qty.${slot}`, String(state.quantities[slot]));
    }
  // Preserve unknown slots in a versioned payload so shared builds never silently lose lines.
  if (
    Object.keys(state.selected).some(
      (slot) => !defaultSettings.global.slots.some((entry) => entry.id === slot),
    )
  )
    url.searchParams.set("build", JSON.stringify(state));
  return url.toString();
}
export function createModel(snapshot: Snapshot) {
  const { settings, components: catalog } = snapshot;
  const markets = Object.fromEntries(
    Object.entries(settings.markets).map(([id, market]) => [
      id,
      {
        ...market,
        hasPrices:
          market.taxBasisPoints !== null &&
          catalog.some((part) =>
            part.offers.some(
              (offer) =>
                offer.market === id && offer.currency === market.currency && offer.available,
            ),
          ),
      },
    ]),
  );
  const selectedParts = (selection: Selection): Component[] =>
    Object.values(selection).flatMap((id) => {
      const part = catalog.find((component) => component.id === id);
      return part ? [part] : [];
    });
  const evaluate = (state: State) => evaluateBuild(toBuild(state), catalog, settings);
  const compatibility = (selection: Selection, quantities: Record<string, number> = {}) =>
    evaluate({
      ...initialState,
      market: settings.global.defaultMarket,
      selected: selection,
      quantities,
    }).compatibility;
  const price = (part: Component, market: string, quantity = 1) =>
    priceComponent(part, market, settings, quantity);
  const candidateRules = (
    part: Component,
    selected: Selection,
    slot: string = part.category,
    quantities: Record<string, number> = {},
  ) =>
    compatibility({ ...selected, [slot]: part.id }, quantities).rules.filter((rule) =>
      rule.categories.includes(part.category),
    );
  const candidateConflicts = (
    part: Component,
    selected: Selection,
    slot: string = part.category,
    quantities: Record<string, number> = {},
  ) => candidateRules(part, selected, slot, quantities).some((rule) => rule.ok === false);
  const available = (part: Component, market: string) =>
    part.offers.some(
      (offer) =>
        offer.market === market &&
        offer.available &&
        offer.currency === settings.markets[market]?.currency,
    );
  return {
    catalog,
    settings,
    markets,
    selectedParts,
    evaluate,
    compatibility,
    price,
    candidateConflicts,
    candidateRules,
    available,
  };
}
export function slotCategory(slot: string, settings: Settings): Category | undefined {
  return settings.global.slots.find((entry) => entry.id === slot)?.category;
}

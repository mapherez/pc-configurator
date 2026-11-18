import { describe, expect, it } from "vite-plus/test";
import portuguese from "../../settings/prototype/locale/pt-PT.json";
import english from "../../settings/prototype/locale/en-US.json";
import {
  candidateConflicts,
  catalog,
  compatibility,
  price,
  restoreState,
  sample,
  selectedParts,
  shareUrl,
  stateFromUrl,
  totals,
  translate,
} from "./model";

describe("configurator prototype domain", () => {
  it("uses integer money, tax per line and the same gross prices in the total", () => {
    const part = catalog.find((item) => item.id === "cpu-7800x3d")!;
    expect(price(part, "pt")).toEqual({ net: 39999, tax: 9200, gross: 49199 });
    const parts = selectedParts(sample);
    const total = totals(parts, "pt")!;
    expect(total.gross).toBe(parts.reduce((sum, item) => sum + price(item, "pt")!.gross, 0));
    expect(total.net + total.tax).toBe(total.gross);
    expect(price(part, "us")).toBeNull();
    expect(totals(parts, "us")).toBeNull();
  });

  it("restores market and language independently, ignores unknown parts and preserves a share link", () => {
    const state = restoreState({
      market: "us",
      language: "pt-PT",
      selected: { ...sample, cpu: "missing" },
    });
    expect(state.market).toBe("us");
    expect(state.language).toBe("pt-PT");
    expect(state.selected.cpu).toBeUndefined();
    const link = shareUrl(state, "http://localhost:5173/prototype.html?cpu=old&gpu=old");
    expect(stateFromUrl(link)).toEqual(state);
    expect(new URL(link).searchParams.has("cpu")).toBe(false);
    expect(restoreState(null).selected).toEqual({});
  });

  it("keeps incomplete checks distinct from conflicts and evaluates candidate-related rules", () => {
    expect(compatibility({ cpu: "cpu-7600" })).toMatchObject({ conflicts: false, pending: true });
    expect(compatibility(sample)).toMatchObject({ conflicts: false, pending: false });
    const conflicting = { ...sample, cpu: "cpu-13600k" };
    expect(compatibility(conflicting).conflicts).toBe(true);
    const ram = catalog.find((item) => item.id === "ram-ddr5-64-2x32")!;
    expect(candidateConflicts(ram, conflicting)).toBe(false);
    const motherboard = catalog.find((item) => item.id === "mobo-b760-matx")!;
    expect(candidateConflicts(motherboard, { cpu: "cpu-7600" })).toBe(true);
  });

  it("provides the same complete locale contract in both languages", () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(portuguese).sort());
    expect(translate("en-US", "progress", { count: 2, total: 6 })).toBe("2 of 6 categories");
  });
});

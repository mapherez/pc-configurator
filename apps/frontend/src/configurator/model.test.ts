import { describe, expect, it } from "vite-plus/test";
import { createModel, restoreState, sample, shareUrl, stateFromUrl, toBuild } from "./model";
import { snapshot } from "../__tests__/snapshot";

const { catalog, compatibility, price, evaluate, candidateConflicts } = createModel(snapshot);
describe("configurator state and shared model", () => {
  it("uses exact net prices from the API and the market tax in totals", () => {
    const part = catalog.find((item) => item.id === "cpu-7800x3d")!;
    expect(price(part, "pt")).toEqual({ net: 39999, tax: 9200, gross: 49199 });
    const state = restoreState({ selected: sample });
    const result = evaluate(state);
    expect(result.total!.gross).toBe(
      result.lines.reduce((sum, line) => sum + line.amount!.gross, 0),
    );
    expect(price(part, "us")).toBeNull();
    expect(evaluate({ ...state, market: "us" }).total).toBeNull();
  });
  it("preserves missing references, independent preferences, positions and quantities in shared links", () => {
    const state = restoreState({
      market: "us",
      language: "pt-PT",
      selected: {
        ...sample,
        cpu: "missing",
        "ram-2": "ram-ddr5-64-2x32",
        fan: "fan-test",
        "removed-slot": "missing",
      },
      quantities: { fan: 3 },
    });
    const url = shareUrl(state, "http://localhost/prototype.html?old=discard");
    expect(stateFromUrl(url)).toEqual(state);
    expect(toBuild(state).lines.find((line) => line.slot === "fan")?.quantity).toBe(3);
    expect(state.market).toBe("us");
    expect(state.language).toBe("pt-PT");
    expect(state.selected.cpu).toBe("missing");
    expect(evaluate(state).issues).toContainEqual({ slot: "cpu", code: "missing_component" });
    expect(evaluate(state).total).toBeNull();
  });
  it("does not call an incomplete specification compatible and filters only candidate-related conflicts", () => {
    expect(compatibility({ cpu: "cpu-7600" })).toMatchObject({ conflicts: false, pending: true });
    expect(compatibility(sample)).toMatchObject({ conflicts: false, pending: false });
    const conflicting = { ...sample, cpu: "cpu-13600k" };
    expect(compatibility(conflicting).conflicts).toBe(true);
    expect(
      candidateConflicts(
        catalog.find((part) => part.id === "ram-ddr5-64-2x32")!,
        conflicting,
      ),
    ).toBe(false);
    expect(
      candidateConflicts(
        catalog.find((part) => part.id === "mobo-b760-matx")!,
        { cpu: "cpu-7600" },
      ),
    ).toBe(true);
  });
  it("uses published defaults only when the visitor did not make a valid explicit choice", () => {
    const settings = structuredClone(snapshot.settings);
    settings.global.defaultMarket = "us";
    settings.global.defaultLanguage = "en-US";
    expect(restoreState(null, settings)).toMatchObject({ market: "us", language: "en-US" });
    expect(restoreState({ market: "pt", language: "pt-PT" }, settings)).toMatchObject({
      market: "pt",
      language: "pt-PT",
    });
    expect(stateFromUrl("http://localhost/")).toBeNull();
    expect(restoreState({ selected: { cpu: "<script>" } }).selected).toEqual({});
  });
});

it("previews only candidate-related checks without changing the selected configuration or quantities", () => {
  const model = createModel(snapshot);
  const selected = { ...sample, cpu: "cpu-13600k" };
  const quantities = { fan: 2 };
  const before = structuredClone({ selected, quantities });
  const ram = catalog.find((part) => part.id === "ram-ddr5-64-2x32")!;
  const checks = model.candidateRules(ram, selected, "ram", quantities);
  expect(checks.every((rule) => rule.categories.includes("ram"))).toBe(true);
  expect(checks.some((rule) => rule.ok === false)).toBe(false);
  expect({ selected, quantities }).toEqual(before);
  const fan = catalog.find((part) => part.id === "fan-demo-140")!;
  expect(
    model.candidateRules(fan, { ...sample, case: "case-compact-itx" }, "fan", quantities),
  ).toContainEqual(expect.objectContaining({ id: "fan_size", ok: false }));
});

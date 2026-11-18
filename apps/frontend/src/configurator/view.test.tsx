import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Configurator, ConfiguratorWorkspace } from "./view";
import { snapshot } from "../__tests__/snapshot";
import { storageKey } from "./model";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/prototype.html");
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("configurator prototype flow", () => {
  it("restores a shared configuration into device storage and reports unavailable persistence", () => {
    window.history.replaceState(null, "", "/prototype.html?cpu=cpu-7600&market=us&locale=en-US");
    render(<ConfiguratorWorkspace snapshot={snapshot} />);
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({
      market: "us",
      language: "en-US",
      selected: { cpu: "cpu-7600" },
    });
    cleanup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    render(<ConfiguratorWorkspace snapshot={snapshot} />);
    expect(screen.getByText("Your browser could not save this configuration.")).toBeInTheDocument();
  });

  it("adds a component, applies tax, shares the selection, and supports undo", async () => {
    const user = userEvent.setup();
    render(<ConfiguratorWorkspace snapshot={snapshot} />);
    await user.click(screen.getByRole("button", { name: "Adicionar Ryzen 7 7800X3D" }));
    const summary = screen.getByRole("complementary");
    expect(within(summary).getByText("Ryzen 7 7800X3D")).toBeInTheDocument();
    expect(within(summary).getAllByText(/491,99/).length).toBeGreaterThan(0);
    expect(new URL(window.location.href).searchParams.get("cpu")).toBe("cpu-7800x3d");
    await user.click(within(summary).getByRole("button", { name: "Remover Ryzen 7 7800X3D" }));
    expect(within(summary).queryByText("Ryzen 7 7800X3D")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(within(summary).getByText("Ryzen 7 7800X3D")).toBeInTheDocument();
    await user.click(within(summary).getAllByRole("button", { name: "Partilhar configuração" })[1]);
    expect(screen.getByRole("dialog")).toBeVisible();
    const link = screen.getByRole("textbox", {
      name: "Partilhar configuração",
    }) as HTMLInputElement;
    expect(new URL(link.value).searchParams.get("cpu")).toBe("cpu-7800x3d");
  });

  it("keeps explicit market and language choices independent without inventing US prices", async () => {
    render(<ConfiguratorWorkspace snapshot={snapshot} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Mercado" }), {
      target: { value: "us" },
    });
    expect(screen.getByRole("combobox", { name: "Mercado" })).toHaveValue("us");
    fireEvent.change(screen.getByRole("combobox", { name: "Idioma" }), {
      target: { value: "en-US" },
    });
    expect(screen.getByRole("combobox", { name: "Market" })).toHaveValue("us");
    expect(
      screen.getByText(
        "A total cannot be calculated: some prices, availability or taxes are not configured for this market.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Tax not configured")).toBeInTheDocument();
    expect(screen.queryByText("Tax (0%)")).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(storageKey)!);
    expect(stored).toMatchObject({ market: "us", language: "en-US" });
  });

  it("filters by final prices and reports incompatibilities using the active locale", async () => {
    const user = userEvent.setup();
    render(<ConfiguratorWorkspace snapshot={snapshot} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Preço máximo, com imposto" }), {
      target: { value: "300" },
    });
    expect(screen.queryByRole("article", { name: "Ryzen 7 7800X3D" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Ryzen 5 7600" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Explorar um exemplo" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Preço máximo, com imposto" }), {
      target: { value: "" },
    });
    await user.click(screen.getByRole("button", { name: "Substituir Intel Core i5-13600K" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Idioma" }), {
      target: { value: "en-US" },
    });
    await user.click(screen.getByRole("button", { name: "View compatibility" }));
    expect(
      within(screen.getByRole("dialog")).getByText("Compatibility conflict"),
    ).toBeInTheDocument();
    expect(screen.getByText("Processor and motherboard socket")).toBeInTheDocument();
  });
});

it("loads published data from the API and offers a recoverable error without replacing saved selections", async () => {
  localStorage.setItem(
    storageKey,
    JSON.stringify({ market: "pt", language: "pt-PT", selected: { cpu: "cpu-7600" } }),
  );
  const user = userEvent.setup();
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ ok: true, json: async () => snapshot });
  vi.stubGlobal("fetch", request);
  render(<Configurator />);
  expect(await screen.findByRole("alert")).toHaveTextContent("O catálogo está indisponível");
  expect(JSON.parse(localStorage.getItem(storageKey)!).selected.cpu).toBe("cpu-7600");
  await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByRole("complementary")).toBeInTheDocument();
  expect(within(screen.getByRole("complementary")).getByText("Ryzen 5 7600")).toBeInTheDocument();
  vi.unstubAllGlobals();
});

it("keeps multiple positions, prices and undo aligned, and flags missing parts without discarding them", async () => {
  window.history.replaceState(
    null,
    "",
    "/?cpu=not-published&ram=ram-ddr5-32-2x16&market=pt&locale=en-US",
  );
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  expect(screen.getByRole("alert")).toHaveTextContent("no longer published");
  expect(screen.getByText("Unavailable component: not-published")).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: "Choose Memory" })[0]);
  await user.click(screen.getByRole("button", { name: "Memory · 2" }));
  await user.click(screen.getByRole("button", { name: "Add DDR5 64GB (2x32) 6000MHz" }));
  const summary = screen.getByRole("complementary");
  expect(within(summary).getByText("DDR5 32GB (2x16) 6000MHz")).toBeInTheDocument();
  expect(within(summary).getByText("DDR5 64GB (2x32) 6000MHz")).toBeInTheDocument();
  expect(new URL(window.location.href).searchParams.get("ram-2")).toBe("ram-ddr5-64-2x32");
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(within(summary).queryByText("DDR5 64GB (2x32) 6000MHz")).not.toBeInTheDocument();
  expect(new URL(window.location.href).searchParams.get("cpu")).toBe("not-published");
});

it("prices quantities as a single rounded line and preserves them in sharing and undo", async () => {
  const { ComponentSchema } = await import("@pc-configurator/domain");
  const fan = ComponentSchema.parse({
    id: "test-fan",
    sku: "TEST",
    name: "Test fan",
    brand: "Example",
    category: "fan",
    status: "published",
    offers: [{ market: "pt", currency: "EUR", netMinor: 1, available: true }],
  });
  const user = userEvent.setup();
  render(
    <ConfiguratorWorkspace snapshot={{ ...snapshot, components: [...snapshot.components, fan] }} />,
  );
  await user.click(screen.getByRole("button", { name: "Escolher Ventoinhas" }));
  await user.click(screen.getByRole("button", { name: "Adicionar Test fan" }));
  const quantity = screen.getByRole("combobox", {
    name: "Quantidade de Test fan · Ventoinhas · 1",
  });
  fireEvent.change(quantity, { target: { value: "3" } });
  expect(quantity).toHaveValue("3");
  expect(within(screen.getByRole("complementary")).getAllByText(/0,04/).length).toBeGreaterThan(0);
  expect(new URL(window.location.href).searchParams.get("qty.fan")).toBe("3");
  await user.click(screen.getByRole("button", { name: "Desfazer" }));
  expect(quantity).toHaveValue("1");
  expect(new URL(window.location.href).searchParams.has("qty.fan")).toBe(false);
});

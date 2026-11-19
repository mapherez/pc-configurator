import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
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

it("shows an attached managed image even when an old seed image path is still present", () => {
  const data = structuredClone(snapshot);
  data.components[0].images = ["/images/missing.png", "/media/asset-test"];
  render(<ConfiguratorWorkspace snapshot={data} />);
  expect(screen.getByRole("img", { name: data.components[0].name })).toHaveAttribute(
    "src",
    "/media/asset-test",
  );
});

it("loads a full example with storage and cooling and completes every applicable compatibility check", async () => {
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  await user.click(screen.getByRole("button", { name: "Explorar um exemplo" }));
  expect(screen.getByText("8 de 8 posições obrigatórias")).toBeInTheDocument();
  const summary = within(screen.getByRole("complementary"));
  expect(summary.getByText("Demo NVMe 1TB")).toBeInTheDocument();
  expect(summary.getByText("Demo Tower 155")).toBeInTheDocument();
  expect(summary.getByText("Demo Air 120")).toBeInTheDocument();
  expect(
    within(screen.getByRole("button", { name: "Ver compatibilidade" })).getByText(
      "Sem conflitos detetados",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Inclui 100 W de reserva para os restantes componentes."),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ver compatibilidade" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getAllByText("Verificado")).toHaveLength(13);
  expect(dialog.queryByText("Requer atenção")).not.toBeInTheDocument();
});

it("filters SSD conflicts by the selected position without concealing unverified specifications", async () => {
  window.history.replaceState(null, "", "/?locale=en-US");
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  await user.click(screen.getByRole("button", { name: "Explore an example" }));
  await user.click(screen.getAllByRole("button", { name: "Choose Motherboard" })[0]);
  await user.click(screen.getByRole("button", { name: "Replace A620I Edge" }));
  await user.click(screen.getAllByRole("button", { name: "Choose Storage" })[0]);
  await user.click(screen.getByRole("button", { name: "Storage · 2" }));
  await user.click(screen.getByRole("checkbox", { name: "Hide known conflicts" }));
  expect(screen.queryByRole("article", { name: "Demo NVMe 2TB" })).not.toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Demo SATA 2TB" })).toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Demo SSD 1TB" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Add Demo SATA 2TB" }));
  expect(
    within(screen.getByRole("button", { name: "View compatibility" })).getByText(
      "No conflicts detected",
    ),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Replace Demo SSD 1TB" }));
  expect(
    within(screen.getByRole("button", { name: "View compatibility" })).getByText(
      "Verification incomplete",
    ),
  ).toBeInTheDocument();
});

it("explains and repairs an excessive quantity restored from a shared link", async () => {
  window.history.replaceState(null, "", "/?locale=en-US&fan=fan-demo-120&qty.fan=4");
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  expect(screen.getByText("Quantity limit for this position: 3.")).toBeInTheDocument();
  const quantity = screen.getByRole("combobox", { name: "Quantity of Demo Air 120 · Fans · 1" });
  expect(quantity).toHaveValue("4");
  await user.selectOptions(quantity, "3");
  expect(screen.queryByText("Quantity limit for this position: 3.")).not.toBeInTheDocument();
  expect(new URL(window.location.href).searchParams.get("qty.fan")).toBe("3");
});

it("repairs a quantity above one on a single-unit position and removes stale quantities with their component", async () => {
  window.history.replaceState(null, "", "/?locale=en-US&ram=ram-ddr5-32-2x16&qty.ram=2");
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  expect(screen.getByText("Quantity limit for this position: 1.")).toBeInTheDocument();
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Quantity of DDR5 32GB (2x16) 6000MHz · Memory · 1" }),
    "1",
  );
  expect(screen.queryByText("Quantity limit for this position: 1.")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove DDR5 32GB (2x16) 6000MHz" }));
  expect(JSON.parse(localStorage.getItem(storageKey)!).quantities).not.toHaveProperty("ram");
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(new URL(window.location.href).searchParams.get("ram")).toBe("ram-ddr5-32-2x16");
});

it("guides the visitor to the next required position while keeping selection and keyboard focus explicit", async () => {
  window.history.replaceState(null, "", "/?locale=en-US");
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  const catalog = within(screen.getByRole("region", { name: "Components" }));
  await user.click(catalog.getByRole("button", { name: "Add Ryzen 5 7600" }));
  expect(catalog.getByRole("heading", { name: "Processor", level: 3 })).toBeInTheDocument();
  expect(catalog.getByText("Ryzen 5 7600 is in this position.")).toBeInTheDocument();
  await user.click(catalog.getByRole("button", { name: "Continue to Motherboard" }));
  await waitFor(() =>
    expect(catalog.getByRole("heading", { name: "Motherboard", level: 3 })).toHaveFocus(),
  );
  expect(JSON.parse(localStorage.getItem(storageKey)!).selected).toEqual({ cpu: "cpu-7600" });
});

it("previews replacement price and conflicts without changing the build until explicitly chosen, then supports undo", async () => {
  window.history.replaceState(null, "", "/?locale=en-US");
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  await user.click(screen.getByRole("button", { name: "Explore an example" }));
  const saved = localStorage.getItem(storageKey),
    href = window.location.href;
  await user.click(screen.getByRole("button", { name: "View impact of Intel Core i5-13600K" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByRole("heading", { name: "Before you choose" })).toBeInTheDocument();
  expect(dialog.getByText(/381[,.]18/)).toBeInTheDocument();
  expect(dialog.getByText(/111[,.]81/)).toBeInTheDocument();
  expect(dialog.getByText("Processor and motherboard socket")).toBeInTheDocument();
  expect(localStorage.getItem(storageKey)).toBe(saved);
  expect(window.location.href).toBe(href);
  await user.click(dialog.getByRole("button", { name: "Choose Intel Core i5-13600K" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(storageKey)!).selected.cpu).toBe("cpu-13600k");
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(JSON.parse(localStorage.getItem(storageKey)!).selected.cpu).toBe("cpu-7600");
});

it("takes a compatibility action to the exact second memory position without altering the build", async () => {
  window.history.replaceState(
    null,
    "",
    "/?locale=en-US&motherboard=mobo-a620-itx&ram=ram-ddr5-32-2x16&ram-2=ram-ddr5-64-2x32",
  );
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  const saved = localStorage.getItem(storageKey);
  await user.click(screen.getByRole("button", { name: "View compatibility" }));
  const dialog = within(screen.getByRole("dialog"));
  const rule = within(
    dialog.getByText("Memory modules, capacity and motherboard limits").closest("li")!,
  );
  await user.click(rule.getByRole("button", { name: "Review Memory · 2" }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Memory", level: 3 })).toHaveFocus(),
  );
  expect(screen.getByRole("button", { name: "Memory · 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(localStorage.getItem(storageKey)).toBe(saved);
});

it("continues to a second required slot of the same category and offers persistent mobile summary access", async () => {
  window.history.replaceState(null, "", "/?locale=en-US");
  const data = structuredClone(snapshot);
  data.settings.global.slots.find((slot) => slot.id === "ram-2")!.required = true;
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={data} />);
  await user.click(screen.getByRole("button", { name: "Explore an example" }));
  const bar = within(screen.getByRole("navigation", { name: "Next position" }));
  await user.click(bar.getByRole("button", { name: "Continue to Memory · 2" }));
  expect(screen.getByRole("button", { name: "Memory · 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await user.click(bar.getByRole("button", { name: "View summary" }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { name: "Your configuration", level: 2 })).toHaveFocus(),
  );
  expect(screen.getByRole("main")).toHaveClass("area-summary");
});

it("offers a quantity repair from the checks dialog even when no physical compatibility rule fails", async () => {
  window.history.replaceState(null, "", "/?locale=en-US&fan=fan-demo-120&qty.fan=4");
  const user = userEvent.setup();
  render(<ConfiguratorWorkspace snapshot={snapshot} />);
  await user.click(screen.getByRole("button", { name: "View compatibility" }));
  const dialog = within(screen.getByRole("dialog"));
  const issue = within(dialog.getByText("Quantity limit for this position: 3.").closest("li")!);
  await user.click(issue.getByRole("button", { name: "Review Fans · 1" }));
  const quantity = screen.getByRole("combobox", { name: "Quantity of Demo Air 120 · Fans · 1" });
  await waitFor(() => expect(quantity).toHaveFocus());
  await user.selectOptions(quantity, "2");
  expect(screen.queryByText("Quantity limit for this position: 3.")).not.toBeInTheDocument();
});

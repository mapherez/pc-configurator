import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfiguratorPrototype } from "./view";
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
    render(<ConfiguratorPrototype />);
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({
      market: "us",
      language: "en-US",
      selected: { cpu: "cpu-7600" },
    });
    cleanup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage disabled");
    });
    render(<ConfiguratorPrototype />);
    expect(screen.getByText("Your browser could not save this configuration.")).toBeInTheDocument();
  });

  it("adds a component, applies tax, shares the selection, and supports undo", async () => {
    const user = userEvent.setup();
    render(<ConfiguratorPrototype />);
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
    render(<ConfiguratorPrototype />);
    fireEvent.change(screen.getByRole("combobox", { name: "Mercado" }), {
      target: { value: "us" },
    });
    expect(screen.getByRole("combobox", { name: "Mercado" })).toHaveValue("us");
    fireEvent.change(screen.getByRole("combobox", { name: "Idioma" }), {
      target: { value: "en-US" },
    });
    expect(screen.getByRole("combobox", { name: "Market" })).toHaveValue("us");
    expect(
      screen.getByText("Prices and taxes for this market have not been configured yet."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tax not configured")).toBeInTheDocument();
    expect(screen.queryByText("Tax (0%)")).not.toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(storageKey)!);
    expect(stored).toMatchObject({ market: "us", language: "en-US" });
  });

  it("filters by final prices and reports incompatibilities using the active locale", async () => {
    const user = userEvent.setup();
    render(<ConfiguratorPrototype />);
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

import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminApp } from "./view";
import { ConfiguratorWorkspace } from "../configurator/view";
import { storageKey } from "../configurator/model";
import { snapshot } from "../__tests__/snapshot";
import { type AdminState, type Component } from "@pc-configurator/domain";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/admin");
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function fixture({ role = "owner", configured = true, conflict = false, expired = false } = {}) {
  const state: AdminState = {
    snapshot: structuredClone(snapshot),
    components: structuredClone(snapshot.components),
    documents: [],
    assets: [],
  };
  const calls: {
    operation: string;
    input: Record<string, unknown>;
    headers: Record<string, string>;
  }[] = [];
  const request = vi.fn(
    async (
      path: string,
      options: { method?: string; body?: string; headers?: Record<string, string> } = {},
    ) => {
      let value: unknown;
      if (path === "/auth/session")
        value = {
          configured,
          actor: configured
            ? {
                issuer: "https://auth.test",
                subject: "owner",
                name: "Owner",
                email: "owner@example.test",
                role,
                scopes:
                  role === "owner"
                    ? ["pc:read", "pc:write", "pc:publish", "pc:admin"]
                    : ["pc:read"],
              }
            : null,
          csrf: "csrf-test",
        };
      else if (path === "/api/admin/state") value = state;
      else if (path === "/api/admin/execute") {
        const body = JSON.parse(options.body!) as {
          operation: string;
          input: Record<string, unknown>;
        };
        calls.push({ ...body, headers: options.headers! });
        if (expired)
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: "login_renewal_required" }),
          };
        if (conflict)
          return { ok: false, status: 409, json: async () => ({ error: "revision_conflict" }) };
        if (body.operation === "component_save") {
          const component = body.input.component as Component;
          state.documents = [
            {
              kind: "component",
              id: component.id,
              revision: 1,
              draft: component,
              published_revision: 0,
            },
          ];
          value = { result: { id: component.id, revision: 1 } };
        } else if (body.operation === "component_publish") {
          const draft = state.documents[0].draft as Component;
          state.documents[0].published_revision = 1;
          state.snapshot.components = state.snapshot.components.map((part) =>
            part.id === draft.id ? { ...draft, status: "published" } : part,
          );
          value = { result: { id: draft.id, revision: 1 } };
        } else value = { result: [] };
      } else if (path === "/api/admin/users" || path === "/api/admin/delegations") value = [];
      else value = {};
      return { ok: true, status: 200, json: async () => structuredClone(value) };
    },
  );
  vi.stubGlobal("fetch", request);
  return { state, calls, request };
}
it("keeps unconfigured management locked and never requests private data", async () => {
  const f = fixture({ configured: false });
  render(<AdminApp />);
  expect(await screen.findByRole("button", { name: "NoX Login" })).toBeDisabled();
  expect(screen.getByText(/ainda não está configurado/)).toBeInTheDocument();
  expect(f.request.mock.calls.every(([path]) => path === "/auth/session")).toBe(true);
});
it("saves a draft without publishing and requires an explicit confirmation to publish the saved revision", async () => {
  const f = fixture(),
    user = userEvent.setup();
  render(<AdminApp />);
  await user.click(await screen.findByRole("button", { name: /Ryzen 7 7800X3D/ }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Updated CPU" } });
  await user.click(screen.getByRole("button", { name: "Guardar rascunho" }));
  expect(
    await screen.findByText("Rascunho guardado. O site público não foi alterado."),
  ).toBeInTheDocument();
  expect(f.calls).toHaveLength(1);
  expect(f.calls[0].operation).toBe("component_save");
  expect(f.calls[0].headers["X-CSRF-Token"]).toBe("csrf-test");
  expect(f.state.snapshot.components[0].name).toBe("Ryzen 7 7800X3D");
  await user.click(screen.getByRole("button", { name: "Publicar" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("Publicar esta revisão?")).toBeInTheDocument();
  expect(f.calls).toHaveLength(1);
  await user.click(within(dialog).getByRole("button", { name: "Publicar" }));
  expect(
    await screen.findByText("A nova versão já está disponível no configurador."),
  ).toBeInTheDocument();
  expect(f.calls[1].input).toEqual({ id: "cpu-7800x3d", revision: 1 });
  expect(f.state.snapshot.components[0].name).toBe("Updated CPU");
});
it("preserves edits on revision conflicts and asks before leaving an unsaved form", async () => {
  fixture({ conflict: true });
  const user = userEvent.setup();
  render(<AdminApp />);
  await user.click(await screen.findByRole("button", { name: /Ryzen 7 7800X3D/ }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Keep my edits" } });
  await user.click(screen.getByRole("button", { name: "Guardar rascunho" }));
  expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent("mudou noutra sessão");
  expect(screen.getByLabelText("Nome")).toHaveValue("Keep my edits");
  await user.click(screen.getByRole("button", { name: "Mercados e settings" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Tens alterações por guardar");
  await user.click(screen.getByRole("button", { name: "Continuar a editar" }));
  expect(screen.getByLabelText("Nome")).toHaveValue("Keep my edits");
});
it("does not expose mutation or access controls to a viewer", async () => {
  fixture({ role: "viewer" });
  const user = userEvent.setup();
  render(<AdminApp />);
  await user.click(await screen.findByRole("button", { name: /Ryzen 7 7800X3D/ }));
  expect(screen.getByLabelText("Nome")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Guardar rascunho" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Publicar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Acesso e MCP" })).not.toBeInTheDocument();
});
it("private preview uses draft locales without changing the public URL or saved build", () => {
  const saved = JSON.stringify({ market: "pt", language: "pt-PT", selected: { cpu: "cpu-7600" } });
  localStorage.setItem(storageKey, saved);
  window.history.replaceState(null, "", "/admin/preview?kind=component&id=cpu-7800x3d&revision=1");
  const url = location.href;
  render(
    <ConfiguratorWorkspace
      snapshot={{ ...snapshot, locales: { "pt-PT": { title: "Título privado" } } }}
      preview
    />,
  );
  expect(screen.getByRole("heading", { level: 1, name: "Título privado" })).toBeInTheDocument();
  expect(localStorage.getItem(storageKey)).toBe(saved);
  expect(location.href).toBe(url);
  expect(screen.queryByRole("button", { name: "Partilhar configuração" })).not.toBeInTheDocument();
});

it("opens a new component safely and derives a stable editable identifier from its name", async () => {
  const f = fixture(),
    user = userEvent.setup();
  render(<AdminApp />);
  await user.click(await screen.findByRole("button", { name: "Novo componente" }));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "New Fan" } });
  expect(screen.getByLabelText("Identificador")).toHaveValue("new-fan");
  fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Example" } });
  await user.click(screen.getByRole("button", { name: "Guardar rascunho" }));
  expect(
    await screen.findByText("Rascunho guardado. O site público não foi alterado."),
  ).toBeInTheDocument();
  expect((f.calls[0].input.component as Component).id).toBe("new-fan");
  expect(f.calls.every((call) => call.operation !== "component_publish")).toBe(true);
});

it("preserves the unsaved form while a session is renewed in another tab", async () => {
  fixture({ expired: true });
  const user = userEvent.setup();
  render(<AdminApp />);
  await user.click(await screen.findByRole("button", { name: /Ryzen 7 7800X3D/ }));
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Keep this through reauthentication" },
  });
  await user.click(screen.getByRole("button", { name: "Guardar rascunho" }));
  expect(
    await screen.findByRole("button", { name: "Renovar NoX Login noutra aba" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Nome")).toHaveValue("Keep this through reauthentication");
  await user.click(screen.getByRole("button", { name: "Já entrei — continuar" }));
  expect(screen.getByLabelText("Nome")).toHaveValue("Keep this through reauthentication");
});

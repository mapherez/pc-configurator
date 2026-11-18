import { afterEach, expect, test, vi } from "vite-plus/test";
import { fetchSnapshot } from "./api";
import { snapshot } from "../__tests__/snapshot";
afterEach(() => vi.unstubAllGlobals());
test("API stays on the app origin, validates data and permits retries after failures", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ components: [] }) })
    .mockResolvedValue({ ok: true, json: async () => snapshot });
  vi.stubGlobal("fetch", request);
  await expect(fetchSnapshot()).rejects.toThrow("offline");
  await expect(fetchSnapshot()).rejects.toThrow("catalog_unavailable");
  await expect(fetchSnapshot()).rejects.toThrow();
  await expect(fetchSnapshot()).resolves.toEqual(snapshot);
  expect(request).toHaveBeenLastCalledWith("/api/configurator", { signal: undefined });
});

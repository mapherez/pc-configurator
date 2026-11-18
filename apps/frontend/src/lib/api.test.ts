import { afterEach, expect, test, vi } from "vite-plus/test";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("API requests stay on the app origin and can retry after a network failure", async () => {
  const request = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValue({ ok: true, json: async () => [{ slug: "cpu-7600" }] });
  vi.stubGlobal("fetch", request);
  const { fetchParts, getApiBase } = await import("./api");
  expect(getApiBase()).toBe("");
  await expect(fetchParts()).rejects.toThrow("offline");
  await expect(fetchParts()).rejects.toThrow("503");
  await expect(fetchParts()).resolves.toEqual([{ slug: "cpu-7600" }]);
  await expect(fetchParts()).resolves.toEqual([{ slug: "cpu-7600" }]);
  expect(request).toHaveBeenCalledTimes(3);
  expect(request).toHaveBeenLastCalledWith("/api/parts");
});

import { AdminSessionSchema, AdminStateSchema, SnapshotSchema } from "@pc-configurator/domain";
export class AdminError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export async function api(
  path: string,
  options: { method?: string; body?: unknown; csrf?: string; signal?: AbortSignal } = {},
): Promise<unknown> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    signal: options.signal,
    credentials: "same-origin",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.csrf ? { "X-CSRF-Token": options.csrf } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new AdminError(body.error ?? "internal_error", response.status);
  }
  return response.json();
}
export const session = async (signal?: AbortSignal) =>
  AdminSessionSchema.parse(await api("/auth/session", { signal }));
export const state = async () => AdminStateSchema.parse(await api("/api/admin/state"));
export const preview = async () =>
  SnapshotSchema.parse(await api(`/api/admin/preview${window.location.search}`));
export const execute = async (operation: string, input: unknown, csrf: string) =>
  (
    (await api("/api/admin/execute", { method: "POST", body: { operation, input }, csrf })) as {
      result: unknown;
    }
  ).result;

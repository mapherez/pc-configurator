import { SnapshotSchema, type Snapshot } from "@pc-configurator/domain";

export async function fetchSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  const response = await fetch("/api/configurator", { signal });
  if (!response.ok) throw new Error("catalog_unavailable");
  return SnapshotSchema.parse(await response.json());
}

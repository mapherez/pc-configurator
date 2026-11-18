import { ComponentSchema, defaultSettings, type Snapshot } from "@pc-configurator/domain";
import cpu from "../../../server/catalog/cpu.json";
import motherboard from "../../../server/catalog/motherboard.json";
import ram from "../../../server/catalog/ram.json";
import gpu from "../../../server/catalog/gpu.json";
import psu from "../../../server/catalog/psu.json";
import cases from "../../../server/catalog/case.json";
// Test fixture only; the production entrypoints never import the seed catalogue.
export const snapshot: Snapshot = {
  settings: structuredClone(defaultSettings),
  components: [...cpu, ...motherboard, ...ram, ...gpu, ...psu, ...cases].map((part) =>
    ComponentSchema.parse(part),
  ),
};

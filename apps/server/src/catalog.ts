import cpu from "../catalog/cpu.json" with { type: "json" };
import gpu from "../catalog/gpu.json" with { type: "json" };
import motherboard from "../catalog/motherboard.json" with { type: "json" };
import ram from "../catalog/ram.json" with { type: "json" };
import psu from "../catalog/psu.json" with { type: "json" };
import cases from "../catalog/case.json" with { type: "json" };
import storage from "../catalog/storage.json" with { type: "json" };
import cooler from "../catalog/cooler.json" with { type: "json" };
import fan from "../catalog/fan.json" with { type: "json" };

// Demonstration only: specifications, net prices and availability are not commercial data.
export const initialCatalog = [
  ...cpu,
  ...gpu,
  ...motherboard,
  ...ram,
  ...psu,
  ...cases,
  ...storage,
  ...cooler,
  ...fan,
];

import cpu from "../catalog/cpu.json" with { type: "json" };
import gpu from "../catalog/gpu.json" with { type: "json" };
import motherboard from "../catalog/motherboard.json" with { type: "json" };
import ram from "../catalog/ram.json" with { type: "json" };
import psu from "../catalog/psu.json" with { type: "json" };
import cases from "../catalog/case.json" with { type: "json" };

// Sample catalogue only. Prices are net EUR; market publication is a later delivery.
export const initialCatalog = [...cpu, ...gpu, ...motherboard, ...ram, ...psu, ...cases];

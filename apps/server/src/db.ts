import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import { initialCatalog } from "./catalog.js";

const identifier = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
export const PartInput = z
  .object({
    slug: identifier,
    sku: z.string().trim().max(120),
    name: z.string().trim().min(1).max(240),
    brand: z.string().trim().min(1).max(120),
    category: identifier,
    netMinor: z.number().int().nonnegative().max(100_000_000),
    images: z.array(z.string().max(2048)).max(20).default([]),
    specs: z.record(z.unknown()).default({}),
  })
  .strict();
export type PartInput = z.input<typeof PartInput>;

export type CatalogPart = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  price: string;
  images: string[];
  specs: Record<string, unknown>;
  categoryId: number;
  category: { id: number; name: string };
};
type PartRow = {
  id: number;
  slug: string;
  sku: string;
  name: string;
  brand: string;
  net_minor: number;
  images: string;
  specs: string;
  category_id: number;
  category_name: string;
};
const selectParts = `SELECT p.*, c.name AS category_name FROM catalog_parts p
  JOIN catalog_categories c ON c.id = p.category_id`;
const schemaVersion = 1;
const applicationId = 1346586183;

export class CatalogStore {
  readonly #db: Database.Database;

  constructor(filename: string) {
    mkdirSync(dirname(filename), { recursive: true });
    this.#db = new Database(filename);
    try {
      this.#db.pragma("foreign_keys = ON");
      this.#db.pragma("busy_timeout = 5000");
      this.#db.transaction(() => {
        const tables = this.#db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all();
        if (tables.length === 0) {
          this.#db.exec(`
            CREATE TABLE catalog_categories (
              id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE
            ) STRICT;
            CREATE TABLE catalog_parts (
              id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, sku TEXT NOT NULL,
              name TEXT NOT NULL, brand TEXT NOT NULL,
              net_minor INTEGER NOT NULL CHECK(net_minor >= 0),
              category_id INTEGER NOT NULL REFERENCES catalog_categories(id),
              images TEXT NOT NULL CHECK(json_valid(images)),
              specs TEXT NOT NULL CHECK(json_valid(specs))
            ) STRICT;
            CREATE INDEX catalog_parts_category ON catalog_parts(category_id);
          `);
          for (const part of initialCatalog) {
            const { id, price, ...details } = part;
            this.createPart({ ...details, slug: id, netMinor: Math.round(price * 100) });
          }
          this.#db.pragma(`application_id = ${applicationId}`);
          this.#db.pragma(`user_version = ${schemaVersion}`);
        }
        this.assertReady();
      })();
      this.#db.pragma("journal_mode = WAL");
    } catch (error) {
      this.#db.close();
      throw error;
    }
  }

  assertReady(): void {
    if (
      this.#db.pragma("application_id", { simple: true }) !== applicationId ||
      this.#db.pragma("user_version", { simple: true }) !== schemaVersion
    ) {
      throw new Error(
        "Unrecognized catalogue database; choose an empty data directory or a compatible backup.",
      );
    }
    this.#db.prepare(`${selectParts} LIMIT 1`).all();
  }

  listParts(): CatalogPart[] {
    return (this.#db.prepare(`${selectParts} ORDER BY p.id`).all() as PartRow[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      name: row.name,
      brand: row.brand,
      price: (row.net_minor / 100).toFixed(2),
      images: JSON.parse(row.images) as string[],
      specs: JSON.parse(row.specs) as Record<string, unknown>,
      categoryId: row.category_id,
      category: { id: row.category_id, name: row.category_name },
    }));
  }

  // Shared repository operation; deliberately not exposed through the public HTTP API.
  createPart(input: PartInput): void {
    const part = PartInput.parse(input);
    this.#db.transaction(() => {
      this.#db
        .prepare("INSERT INTO catalog_categories(name) VALUES (?) ON CONFLICT(name) DO NOTHING")
        .run(part.category);
      this.#db
        .prepare(`INSERT INTO catalog_parts (slug, sku, name, brand, net_minor, category_id, images, specs)
        VALUES (@slug, @sku, @name, @brand, @netMinor,
          (SELECT id FROM catalog_categories WHERE name = @category), @images, @specs)`)
        .run({
          ...part,
          images: JSON.stringify(part.images),
          specs: JSON.stringify(part.specs),
        });
    })();
  }

  close(): void {
    this.#db.close();
  }
}

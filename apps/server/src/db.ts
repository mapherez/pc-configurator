import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import {
  ComponentSchema,
  SettingsPatchSchema,
  mergeSettings,
  resolveSettings,
  LocaleOverridesSchema,
  type ComponentInput,
  type SettingsPatch,
  type Snapshot,
} from "@pc-configurator/domain";
import { initialCatalog } from "./catalog.js";

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
  images: string;
  specs: string;
  category_id: number;
  category_name: string;
};
const selectParts = `SELECT p.*, c.name AS category_name FROM catalog_parts p
  JOIN catalog_categories c ON c.id = p.category_id`;
const schemaVersion = 2;
const applicationId = 1346586183;

export class CatalogStore {
  readonly #db: Database.Database;

  constructor(filename: string) {
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.#db = new Database(filename);
    chmodSync(filename, 0o600);
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
          this.#db.pragma(`application_id = ${applicationId}`);
          this.#db.pragma("user_version = 1");
        }
        const version = this.#db.pragma("user_version", { simple: true });
        const owner = this.#db.pragma("application_id", { simple: true });
        if (owner !== applicationId || (version !== 1 && version !== schemaVersion)) {
          throw new Error(
            "Unrecognized catalogue database; choose an empty data directory or a compatible backup.",
          );
        }
        if (version === 1) {
          this.#db.exec(`
            CREATE TABLE component_details (
              part_id INTEGER PRIMARY KEY REFERENCES catalog_parts(id) ON DELETE CASCADE,
              status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'archived')),
              product_id TEXT, variant TEXT NOT NULL CHECK(json_valid(variant)),
              visual TEXT CHECK(visual IS NULL OR json_valid(visual))
            ) STRICT;
            CREATE TABLE market_offers (
              part_id INTEGER NOT NULL REFERENCES catalog_parts(id) ON DELETE CASCADE,
              market TEXT NOT NULL, currency TEXT NOT NULL,
              net_minor INTEGER NOT NULL CHECK(net_minor >= 0),
              available INTEGER NOT NULL CHECK(available IN (0, 1)),
              PRIMARY KEY(part_id, market)
            ) STRICT;
            CREATE TABLE published_settings (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL CHECK(json_valid(value))) STRICT;
            INSERT INTO component_details(part_id, status, variant) SELECT id, 'published', '{}' FROM catalog_parts;
            INSERT INTO market_offers(part_id, market, currency, net_minor, available) SELECT id, 'pt', 'EUR', net_minor, 1 FROM catalog_parts;
            ALTER TABLE catalog_parts DROP COLUMN net_minor;
          `);
          this.#db.pragma(`user_version = ${schemaVersion}`);
        }
        if (tables.length === 0) {
          for (const part of initialCatalog) {
            this.createPart(ComponentSchema.parse(part));
          }
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
    this.#db
      .prepare(
        `${selectParts} JOIN component_details d ON d.part_id = p.id LEFT JOIN market_offers o ON o.part_id = p.id LIMIT 1`,
      )
      .all();
    this.snapshot();
  }

  snapshot(): Snapshot {
    const stored = this.#db.prepare("SELECT value FROM published_settings WHERE id = 1").get() as
      | { value: string }
      | undefined;
    const settings = resolveSettings(stored ? JSON.parse(stored.value) : {});
    const rows = this.#db
      .prepare(
        `${selectParts} JOIN component_details d ON d.part_id = p.id WHERE d.status = 'published' ORDER BY p.id`,
      )
      .all() as PartRow[];
    const components = rows.map((row) => {
      const details = this.#db
        .prepare("SELECT * FROM component_details WHERE part_id = ?")
        .get(row.id) as { product_id: string | null; variant: string; visual: string | null };
      const offers = this.#db
        .prepare(
          "SELECT market, currency, net_minor, available FROM market_offers WHERE part_id = ? ORDER BY market",
        )
        .all(row.id) as {
        market: string;
        currency: string;
        net_minor: number;
        available: number;
      }[];
      return ComponentSchema.parse({
        id: row.slug,
        sku: row.sku,
        name: row.name,
        brand: row.brand,
        category: row.category_name,
        status: "published",
        images: JSON.parse(row.images),
        specs: JSON.parse(row.specs),
        ...(details.product_id ? { productId: details.product_id } : {}),
        variant: JSON.parse(details.variant),
        ...(details.visual ? { visual: JSON.parse(details.visual) } : {}),
        offers: offers.map((offer) => ({
          market: offer.market,
          currency: offer.currency,
          netMinor: offer.net_minor,
          available: Boolean(offer.available),
        })),
      });
    });
    const hasLocales = this.#db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'published_locales'")
      .get();
    const locales = hasLocales
      ? Object.fromEntries(
          (
            this.#db.prepare("SELECT language,value FROM published_locales").all() as {
              language: string;
              value: string;
            }[]
          ).map((row) => [row.language, JSON.parse(row.value)]),
        )
      : {};
    return { settings, components, locales: LocaleOverridesSchema.parse(locales) };
  }

  listParts(): CatalogPart[] {
    const published = this.snapshot().components;
    return (this.#db.prepare(`${selectParts} ORDER BY p.id`).all() as PartRow[]).flatMap((row) => {
      const part = published.find((component) => component.id === row.slug);
      const offer = part?.offers.find(
        (entry) => entry.market === "pt" && entry.currency === "EUR" && entry.available,
      );
      return part && offer
        ? [
            {
              id: row.id,
              slug: part.id,
              sku: part.sku,
              name: part.name,
              brand: part.brand,
              price: (offer.netMinor / 100).toFixed(2),
              images: part.images,
              specs: part.specs,
              categoryId: row.category_id,
              category: { id: row.category_id, name: row.category_name },
            },
          ]
        : [];
    });
  }

  // These operations are private repository methods; management authorization comes later.
  createPart(input: ComponentInput): void {
    const part = ComponentSchema.parse(input);
    this.#db.transaction(() => {
      this.#db
        .prepare("INSERT INTO catalog_categories(name) VALUES (?) ON CONFLICT(name) DO NOTHING")
        .run(part.category);
      const result = this.#db
        .prepare(`INSERT INTO catalog_parts (slug, sku, name, brand, category_id, images, specs)
        VALUES (@id, @sku, @name, @brand, (SELECT id FROM catalog_categories WHERE name = @category), @images, @specs)`)
        .run({
          id: part.id,
          sku: part.sku,
          name: part.name,
          brand: part.brand,
          category: part.category,
          images: JSON.stringify(part.images),
          specs: JSON.stringify(part.specs),
        });
      this.#db
        .prepare(
          "INSERT INTO component_details(part_id, status, product_id, variant, visual) VALUES (?, ?, ?, ?, ?)",
        )
        .run(
          result.lastInsertRowid,
          part.status,
          part.productId ?? null,
          JSON.stringify(part.variant),
          part.visual ? JSON.stringify(part.visual) : null,
        );
      const addOffer = this.#db.prepare(
        "INSERT INTO market_offers(part_id, market, currency, net_minor, available) VALUES (?, ?, ?, ?, ?)",
      );
      for (const offer of part.offers)
        addOffer.run(
          result.lastInsertRowid,
          offer.market,
          offer.currency,
          offer.netMinor,
          Number(offer.available),
        );
    })();
  }

  publishSettings(input: SettingsPatch): void {
    const next = SettingsPatchSchema.parse(input);
    this.#db.transaction(() => {
      const current = this.#db
        .prepare("SELECT value FROM published_settings WHERE id = 1")
        .get() as { value: string } | undefined;
      const combined = mergeSettings(current ? JSON.parse(current.value) : {}, next);
      resolveSettings(combined);
      this.#db
        .prepare(
          "INSERT INTO published_settings(id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value",
        )
        .run(JSON.stringify(combined));
    })();
  }

  /** Internal transaction boundary shared by management, audit and sessions. */
  get database(): Database.Database {
    return this.#db;
  }

  replacePart(input: ComponentInput): void {
    const part = ComponentSchema.parse(input);
    this.#db.transaction(() => {
      const row = this.#db.prepare("SELECT id FROM catalog_parts WHERE slug = ?").get(part.id) as
        | { id: number }
        | undefined;
      if (!row) {
        this.createPart(part);
        return;
      }
      this.#db
        .prepare("INSERT INTO catalog_categories(name) VALUES (?) ON CONFLICT(name) DO NOTHING")
        .run(part.category);
      this.#db
        .prepare(`UPDATE catalog_parts SET sku = @sku, name = @name, brand = @brand,
        category_id = (SELECT id FROM catalog_categories WHERE name = @category), images = @images, specs = @specs WHERE id = @partId`)
        .run({
          partId: row.id,
          sku: part.sku,
          name: part.name,
          brand: part.brand,
          category: part.category,
          images: JSON.stringify(part.images),
          specs: JSON.stringify(part.specs),
        });
      this.#db
        .prepare(
          "UPDATE component_details SET status = ?, product_id = ?, variant = ?, visual = ? WHERE part_id = ?",
        )
        .run(
          part.status,
          part.productId ?? null,
          JSON.stringify(part.variant),
          part.visual ? JSON.stringify(part.visual) : null,
          row.id,
        );
      this.#db.prepare("DELETE FROM market_offers WHERE part_id = ?").run(row.id);
      const insert = this.#db.prepare(
        "INSERT INTO market_offers(part_id, market, currency, net_minor, available) VALUES (?, ?, ?, ?, ?)",
      );
      for (const offer of part.offers)
        insert.run(row.id, offer.market, offer.currency, offer.netMinor, Number(offer.available));
    })();
  }

  allComponents() {
    const rows = this.#db
      .prepare(`${selectParts} JOIN component_details d ON d.part_id = p.id ORDER BY p.id`)
      .all() as PartRow[];
    // Snapshot parser is shared; temporarily selecting by status is unnecessary for management reads.
    return rows.map((row) => this.componentById(row.slug)!);
  }

  componentById(id: string) {
    const row = this.#db.prepare(`${selectParts} WHERE p.slug = ?`).get(id) as PartRow | undefined;
    if (!row) return null;
    const details = this.#db
      .prepare("SELECT * FROM component_details WHERE part_id = ?")
      .get(row.id) as {
      status: string;
      product_id: string | null;
      variant: string;
      visual: string | null;
    };
    const offers = this.#db
      .prepare("SELECT market, currency, net_minor, available FROM market_offers WHERE part_id = ?")
      .all(row.id) as { market: string; currency: string; net_minor: number; available: number }[];
    return ComponentSchema.parse({
      id: row.slug,
      sku: row.sku,
      name: row.name,
      brand: row.brand,
      category: row.category_name,
      status: details.status,
      images: JSON.parse(row.images),
      specs: JSON.parse(row.specs),
      variant: JSON.parse(details.variant),
      ...(details.product_id ? { productId: details.product_id } : {}),
      ...(details.visual ? { visual: JSON.parse(details.visual) } : {}),
      offers: offers.map((offer) => ({
        market: offer.market,
        currency: offer.currency,
        netMinor: offer.net_minor,
        available: Boolean(offer.available),
      })),
    });
  }

  close(): void {
    this.#db.close();
  }
}

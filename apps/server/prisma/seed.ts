import { PrismaClient, type Prisma } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

type Item = {
  id: string;
  sku?: string;
  name: string;
  brand?: string;
  category: string;
  price: number;
  images?: string[];
  specs?: Prisma.InputJsonValue;
};

async function load(file: string): Promise<Item[]> {
  const p = path.join(process.cwd(), 'prisma', 'data', file);
  const raw = await readFile(p, 'utf8');
  return JSON.parse(raw) as Item[];
}

async function upsertCategory(name: string) {
  return prisma.category.upsert({ where: { name }, update: {}, create: { name } });
}

async function seed() {
  const files = ['cpu.json', 'gpu.json', 'motherboard.json', 'ram.json', 'psu.json', 'case.json'];
  const all: Item[] = (await Promise.all(files.map(load))).flat();

  // Ensure categories exist
  const categories = Array.from(new Set(all.map((i) => i.category)));
  const catMap = new Map<string, number>();
  for (const c of categories) {
    const cat = await upsertCategory(c);
    catMap.set(c, cat.id);
  }

  for (const item of all) {
    await prisma.part.upsert({
      where: { slug: item.id },
      update: {
        sku: item.sku ?? '',
        name: item.name,
        brand: item.brand ?? '',
        price: item.price.toString(),
        images: item.images ?? [],
        specs: (item.specs as Prisma.InputJsonValue) ?? null,
        categoryId: catMap.get(item.category) ?? null,
      },
      create: {
        slug: item.id,
        sku: item.sku ?? '',
        name: item.name,
        brand: item.brand ?? '',
        price: item.price.toString(),
        images: item.images ?? [],
        specs: (item.specs as Prisma.InputJsonValue) ?? null,
        categoryId: catMap.get(item.category) ?? null,
      },
    });
  }
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

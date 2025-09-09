import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cpu = await prisma.category.upsert({
    where: { name: 'CPU' },
    update: {},
    create: { name: 'CPU' },
  });
  const gpu = await prisma.category.upsert({
    where: { name: 'GPU' },
    update: {},
    create: { name: 'GPU' },
  });

  await prisma.part.createMany({
    data: [
      { name: 'Ryzen 5 7600', price: '219.99', categoryId: cpu.id },
      { name: 'Core i5-13400F', price: '189.99', categoryId: cpu.id },
      { name: 'RTX 4070', price: '549.99', categoryId: gpu.id },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


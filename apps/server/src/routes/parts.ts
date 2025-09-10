import { Router, type Request, type Response, type NextFunction } from 'express';
import type { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';

export function partsRouter(prisma: PrismaClient) {
  const router = Router();

  router.get('/parts', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const parts = await prisma.part.findMany({ include: { category: true } });
      res.json(parts);
    } catch (e) {
      next(e);
    }
  });

  const PartInput = z.object({
    name: z.string().min(1),
    price: z.number().nonnegative(),
    categoryId: z.number().int().optional(),
  });

  function slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  router.post('/parts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = PartInput.parse(req.body);

      const createData: Prisma.PartCreateInput = {
        slug: slugify(data.name),
        sku: '',
        name: data.name,
        brand: '',
        price: data.price.toString(),
        images: [],
        ...(data.categoryId !== undefined
          ? { category: { connect: { id: data.categoryId } } }
          : {}),
      };

      const part = await prisma.part.create({ data: createData });
      res.status(201).json(part);
    } catch (e: any) {
      if (e?.name === 'ZodError') {
        res.status(400).json({ error: 'Invalid input', details: e.errors });
      } else {
        next(e);
      }
    }
  });

  return router;
}

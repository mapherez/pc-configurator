import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function partsRouter(prisma: PrismaClient) {
  const router = Router();

  router.get('/parts', async (_req, res, next) => {
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

  router.post('/parts', async (req, res, next) => {
    try {
      const data = PartInput.parse(req.body);
      const part = await prisma.part.create({ data });
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


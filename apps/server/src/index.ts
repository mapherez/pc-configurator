import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { PrismaClient } from '@prisma/client';
import { partsRouter } from './routes/parts.js';

const app = express();
app.use(express.json());

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = env.CORS_ORIGINS.some((o) => {
      if (o instanceof RegExp) return o.test(origin);
      return o === origin;
    });
    if (allowed) callback(null, true);
    else callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
};
app.use(cors(corsOptions));

const prisma = new PrismaClient();

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV, time: new Date().toISOString() });
});

app.use('/api', partsRouter(prisma));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const port = env.PORT ?? 3001;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});


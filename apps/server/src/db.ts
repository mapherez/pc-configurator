import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { env } from './env.js';

type GlobalStore = typeof globalThis & {
  prisma?: PrismaClient;
  libsqlAdapter?: PrismaLibSQL;
};

const globalForPrisma = globalThis as GlobalStore;

function buildPrismaClient() {
  if (env.TURSO_DATABASE_URL) {
    const adapter =
      globalForPrisma.libsqlAdapter ??
      new PrismaLibSQL({
        url: env.TURSO_DATABASE_URL,
        authToken: env.TURSO_AUTH_TOKEN,
      });

    if (!globalForPrisma.libsqlAdapter) {
      globalForPrisma.libsqlAdapter = adapter;
    }

    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? buildPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

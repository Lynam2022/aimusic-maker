// Polyfill for Node.js util.inspect on Edge runtime to prevent inspect.custom crash
if (typeof (globalThis as any).util === 'undefined') {
  (globalThis as any).util = { inspect: { custom: Symbol.for('nodejs.util.inspect.custom') } };
}

import { PrismaClient } from '@prisma/client';

// Prevent multiple Prisma instances in development (hot reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

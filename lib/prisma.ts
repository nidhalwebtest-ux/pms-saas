// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Scripts that do heavy interactive transactions (e.g. the test-data seeder)
// must NOT go through Supabase's transaction-mode pooler (DATABASE_URL, port
// 6543, pgbouncer=true) — interactive transactions break over it because the
// pooler can route statements in one tx to different backends. Such scripts set
// PRISMA_USE_DIRECT_URL=1 to route through the direct connection (DIRECT_URL,
// port 5432). The app in production leaves this unset and keeps using the
// pooler, which is the correct choice for serverless request handlers.
const useDirectUrl =
  process.env.PRISMA_USE_DIRECT_URL === "1" && !!process.env.DIRECT_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(useDirectUrl ? { datasourceUrl: process.env.DIRECT_URL } : {}),
    // Default interactive-transaction timeout is 5s, which is too tight for
    // invoice generation against the remote Supabase DB (eu-west-1) — the
    // network round-trips for multi-line-item invoices occasionally exceed it.
    // maxWait: time to acquire a connection; timeout: max duration of the tx body.
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

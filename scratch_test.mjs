import { PrismaClient } from '@prisma/client';

const dbUrls = [
  {
    name: "Supabase Pooler 6543 (pgbouncer)",
    url: "postgresql://postgres.sbkcddkpmrouigprcfcc:NhacAiDatabaseSuperStrongPassword2026!%23@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
  },
  {
    name: "Supabase Session Pooler 5432",
    url: "postgresql://postgres.sbkcddkpmrouigprcfcc:NhacAiDatabaseSuperStrongPassword2026!%23@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
  },
  {
    name: "Supabase Direct Connection 5432",
    url: "postgresql://postgres:NhacAiDatabaseSuperStrongPassword2026!%23@db.sbkcddkpmrouigprcfcc.supabase.co:5432/postgres"
  }
];

async function main() {
  for (const item of dbUrls) {
    console.log(`\n=== Testing: ${item.name} ===`);
    const prisma = new PrismaClient({ datasources: { db: { url: item.url } } });
    try {
      const userCount = await prisma.user.count();
      console.log(`SUCCESS! User count: ${userCount}`);
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main();

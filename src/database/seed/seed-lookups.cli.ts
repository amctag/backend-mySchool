import 'dotenv/config';
import { SeedPrismaClient } from './seed-prisma.client';
import { seedLookups } from './seed-lookups';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const prisma = new SeedPrismaClient(connectionString);

async function main(): Promise<void> {
  console.log('Seeding nationalities, jobs, Lebanon governorates, and regions...');
  await seedLookups(prisma);
  console.log('Lookups seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.disconnect();
  });

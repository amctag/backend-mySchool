import 'dotenv/config';
import { SeedPrismaClient } from './seed-prisma.client';

/**
 * DEV/TEST ONLY — Chart of Accounts 4111 branch seed.
 *
 * Creates the small structural branch for a single school (default: school 3):
 *
 *   4 / حسابات الطرف الثالث (group)
 *   └── 41 / الزبائن (group)
 *       └── 411 / فواتير العملاء (group)
 *           └── 4111 / الزبائن العاديين (group)
 *
 * With --dummies=N it also creates N DUMMY PERSON posting accounts
 * (41110001, 41110002, ...) under 4111 for tree/code-allocation testing.
 *
 * SAFETY:
 * - Never runs automatically; invoke explicitly with ts-node.
 * - Refuses to run when NODE_ENV=production.
 * - Idempotent per (school_id, code): re-runs only fill gaps.
 * - NEVER links dummy accounts to real persons (persons.account_id untouched).
 * - NEVER touches the 235 imported parents.
 *
 * Usage:
 *   npx ts-node src/database/seed/seed-chart-4111.cli.ts --school=3
 *   npx ts-node src/database/seed/seed-chart-4111.cli.ts --school=3 --dummies=5
 */
const BRANCH: Array<{ code: string; name: string }> = [
  { code: '4', name: 'حسابات الطرف الثالث' },
  { code: '41', name: 'الزبائن' },
  { code: '411', name: 'فواتير العملاء' },
  { code: '4111', name: 'الزبائن العاديين' },
];

const DUMMY_NAMES = [
  'Dummy Parent 1',
  'Dummy Parent 2',
  'Dummy Parent 3',
  'Dummy Parent 4',
  'Dummy Parent 5',
];

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-chart-4111 is dev-only and refuses to run in production');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }
  const schoolId = Number(arg('school') ?? '3');
  if (!Number.isInteger(schoolId) || schoolId < 1) {
    throw new Error('--school must be a positive integer');
  }
  const dummyCount = Number(arg('dummies') ?? '0');
  if (!Number.isInteger(dummyCount) || dummyCount < 0 || dummyCount > 99) {
    throw new Error('--dummies must be an integer between 0 and 99');
  }

  const prisma = new SeedPrismaClient(connectionString);
  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });
    if (!school) {
      throw new Error(`School ${schoolId} does not exist`);
    }

    let parentId: number | null = null;
    for (const level of BRANCH) {
      const existing = await prisma.account.findFirst({
        where: { schoolId, code: level.code },
        select: { id: true, schoolId: true },
      });
      if (existing) {
        if (existing.schoolId !== schoolId) {
          throw new Error(`Code ${level.code} belongs to another school`);
        }
        parentId = existing.id;
        console.log(`exists: ${level.code} / ${level.name} (id=${existing.id})`);
        continue;
      }
      const created = await prisma.account.create({
        data: {
          code: level.code,
          name: level.name,
          type: 'GENERAL',
          schoolId,
          parentId,
          isGroup: true,
        },
        select: { id: true },
      });
      parentId = created.id;
      console.log(`created: ${level.code} / ${level.name} (id=${created.id})`);
    }

    for (let index = 0; index < dummyCount; index += 1) {
      const code = `4111${String(index + 1).padStart(4, '0')}`;
      const name = DUMMY_NAMES[index] ?? `Dummy Parent ${index + 1}`;
      const existing = await prisma.account.findFirst({
        where: { schoolId, code },
        select: { id: true },
      });
      if (existing) {
        console.log(`exists: ${code} / ${name} (id=${existing.id})`);
        continue;
      }
      const created = await prisma.account.create({
        data: {
          code,
          name,
          type: 'PERSON',
          schoolId,
          parentId,
          isGroup: false,
        },
        select: { id: true },
      });
      console.log(`created: ${code} / ${name} (id=${created.id})`);
    }

    if (dummyCount > 0) {
      const top = `4111${String(dummyCount).padStart(4, '0')}`;
      const seq = Number(top.slice(4));
      await prisma.$executeRaw`
        INSERT INTO "account_code_counters" ("school_id", "prefix", "last_seq")
        VALUES (${schoolId}, '4111', ${seq})
        ON CONFLICT ("school_id", "prefix")
        DO UPDATE SET "last_seq" = GREATEST("account_code_counters"."last_seq", ${seq})
      `;
      console.log(`counter: school ${schoolId} / 4111 synced to ${seq}`);
    }
    console.log('Chart 4111 seed complete. No persons were modified.');
  } finally {
    await prisma.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

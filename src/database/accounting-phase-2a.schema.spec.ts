import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260926150000_account_school_scope/migration.sql',
);

function modelBlock(modelName: string): string {
  const match = schema.match(
    new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`, 'm'),
  );
  if (!match?.[0]) {
    throw new Error(`Missing Prisma model ${modelName}`);
  }
  return match[0];
}

describe('Accounting Phase 2A schema contract', () => {
  it('scopes accounts to a required school with an index', () => {
    const account = modelBlock('Account');
    expect(account).toMatch(/schoolId\s+Int\s+@map\("school_id"\)/);
    expect(account).toMatch(
      /school\s+School\s+@relation\(fields: \[schoolId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(account).toContain('@@index([schoolId])');
    expect(modelBlock('School')).toContain('accounts');
  });

  it('uses an additive migration and a global sequence starting at 100001', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain(
      'ALTER TABLE "accounts" ADD COLUMN "school_id" INTEGER NOT NULL;',
    );
    expect(migration).toMatch(
      /CREATE SEQUENCE "account_code_seq"[\s\S]*START 100001/,
    );
    expect(migration).toContain(
      'CREATE INDEX "accounts_school_id_idx" ON "accounts"("school_id");',
    );
    expect(migration).toContain(
      'ALTER TABLE "accounts" ADD CONSTRAINT "accounts_school_id_fkey"',
    );
    expect(migration).not.toMatch(
      /DROP TABLE|DROP COLUMN|DROP INDEX|TRUNCATE|DELETE FROM|ALTER COLUMN/i,
    );
  });
});

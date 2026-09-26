import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
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

function migrationChecksum(name: string): string {
  const raw = readFileSync(
    resolve(process.cwd(), `prisma/migrations/${name}/migration.sql`),
    'utf8',
  );
  // Normalize line endings so the tripwire is immune to checkout settings.
  const normalized = raw.replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

describe('Accounting Phase 2C schema contract', () => {
  it('adds a global currency catalog', () => {
    const currency = modelBlock('Currency');
    expect(currency).toMatch(/id\s+Int\s+@id\s+@default\(autoincrement\(\)\)/);
    expect(currency).toMatch(/title\s+String\s+@db\.VarChar\(255\)/);
    expect(currency).toMatch(
      /shortCode\s+String\s+@unique\s+@map\("short_code"\)/,
    );
    expect(currency).toMatch(/symbol\s+String\s+@db\.VarChar\(16\)/);
    expect(currency).toMatch(/rate\s+Decimal\s+@db\.Decimal\(18,\s*6\)/);
    expect(currency).toMatch(/createdAt\s+DateTime\s+@default\(now\(\)\)/);
    expect(currency).toMatch(/updatedAt\s+DateTime\s+@updatedAt/);
    expect(currency).toContain('@@map("currency")');
  });

  it('extends AccountType with GENERAL only', () => {
    expect(schema).toMatch(
      /enum AccountType \{[\s\S]*?PERSON[\s\S]*?CASH[\s\S]*?SALES[\s\S]*?PURCHASES[\s\S]*?GENERAL[\s\S]*?\}/,
    );
  });

  it('links registers to currencies without cascade deletes', () => {
    const register = modelBlock('AccountingRegister');
    expect(register).toMatch(
      /currency\s+Currency\?\s+@relation\(fields:\s*\[currencyId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/,
    );
    expect(register).toContain('@@index([currencyId])');
  });

  it('adds receipt allocation details owned by the receipt', () => {
    const detail = modelBlock('AccountingReceiptDetail');
    expect(detail).toMatch(
      /accountingReceiptId\s+Int\s+@map\("accounting_receipt_id"\)/,
    );
    expect(detail).toMatch(/accountId\s+Int\s+@map\("account_id"\)/);
    expect(detail).toMatch(/amount\s+Decimal\s+@db\.Decimal\(18,\s*2\)/);
    expect(detail).toMatch(
      /receipt\s+AccountingReceipt\s+@relation\(fields:\s*\[accountingReceiptId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    );
    expect(detail).toMatch(
      /account\s+Account\s+@relation\(fields:\s*\[accountId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/,
    );
    expect(detail).toContain('@@map("accounting_receipt_details")');
    expect(modelBlock('AccountingReceipt')).toContain('details');
  });

  it('keeps applied accounting migrations byte-stable', () => {
    expect(migrationChecksum('20260926120000_add_accounting_phase_1')).toBe(
      'c06b16bb512be486ce1991ce578eb92c87bd078c72c0ffe03d491c22666a2d5a',
    );
    expect(migrationChecksum('20260926150000_account_school_scope')).toBe(
      '09cb844045479dccb9c20eb31043469dd2e732f3636ee2b70f91be381c40dde0',
    );
    expect(migrationChecksum('20260926160000_accounting_phase_2b')).toBe(
      'f3d6b2df1155b5d96d159720db284be95fa54bc59858e68385119f122a2e8bba',
    );
  });

  it('ships Phase 2C as a purely additive migration', () => {
    const dir = '20260926180000_accounting_phase_2c';
    const path = resolve(
      process.cwd(),
      `prisma/migrations/${dir}/migration.sql`,
    );
    expect(existsSync(path)).toBe(true);
    const migration = readFileSync(path, 'utf8');
    expect(migration).toContain(`ALTER TYPE "AccountType" ADD VALUE 'GENERAL'`);
    expect(migration).toContain('CREATE TABLE "currency"');
    expect(migration).toContain('CREATE TABLE "accounting_receipt_details"');
    expect(migration).toContain("'US Dollar', 'USD'");
    expect(migration).toContain("'Lebanese Pound', 'LBP'");
    expect(migration).not.toMatch(
      /DROP TABLE|DROP COLUMN|DROP INDEX|TRUNCATE|DELETE FROM/i,
    );
  });

  it('never silently rewrites existing currency references', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260926180000_accounting_phase_2c/migration.sql',
      ),
      'utf8',
    );
    expect(migration).not.toMatch(/SET\s+"currency_id"\s*=\s*NULL/i);
    expect(migration).not.toMatch(
      /ALTER TABLE "accounting_register" ALTER COLUMN "currency_id" SET NOT NULL/i,
    );
  });

  it('fails loudly on orphan currency ids before creating the FK', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260926180000_accounting_phase_2c/migration.sql',
      ),
      'utf8',
    );
    expect(migration).toMatch(/RAISE EXCEPTION[\s\S]*?orphan currency_id/i);
    const gateAt = migration.search(/RAISE EXCEPTION/i);
    const fkAt = migration.search(
      /ADD CONSTRAINT "accounting_register_currency_id_fkey"/,
    );
    expect(gateAt).toBeGreaterThanOrEqual(0);
    expect(fkAt).toBeGreaterThan(gateAt);
  });
});

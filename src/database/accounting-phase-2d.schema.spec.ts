import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    root,
    'prisma/migrations/20260928120000_accounting_phase_2d/migration.sql',
  ),
  'utf8',
);

describe('Accounting Phase 2D schema', () => {
  it('stores payment funding allocations without changing historical tables', () => {
    expect(schema).toContain('model AccountingPaymentDetail');
    expect(schema).toContain('@@map("accounting_payment_details")');
    expect(migration).toContain('CREATE TABLE "accounting_payment_details"');
    expect(migration).toContain('ON DELETE RESTRICT');
    expect(migration).not.toMatch(/DROP|TRUNCATE/i);
  });
});

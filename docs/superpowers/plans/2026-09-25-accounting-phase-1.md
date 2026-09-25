# Accounting Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add and verify the approved Accounting Phase 1 Prisma schema, PostgreSQL migration, and idempotent lookup records without implementing any Phase 2 behavior.

**Architecture:** Extend the existing Prisma schema with the approved accounting models and reverse relations, while keeping `Person.accountId`, `Account(id, code)`, and unbound nullable `currencyId`/`userId` exactly as specified. Protect the contract with a schema/seed regression test, generate and inspect a create-only migration before applying it, then verify the applied structure and seed rows directly in development PostgreSQL.

**Tech Stack:** NestJS 11, TypeScript 5.7, Jest 30, Prisma 7.9, PostgreSQL, npm.

**Spec:** `docs/superpowers/specs/2026-09-25-accounting-phase-1-design.md`

## Global Constraints

- Do not redesign the approved database structure.
- Keep `Person.accountId` mapped to nullable `persons.account_id` with an `Account` relation.
- Keep `Account` limited to `id`, unique `code`, and technically required reverse relations.
- Keep `currencyId` and `userId` nullable integers without foreign keys.
- Do not implement Phase 2 APIs, posting, numbering, installment business logic, frontend pages, or navigation.
- Do not use `prisma db push`, `prisma migrate reset`, or a force-reset option.
- Do not drop/recreate existing tables or modify/delete existing rows.
- Do not execute the destructive full development seed.
- Phase 1 does not impose the final document-`nb` uniqueness rule.

## Review Focus

- Existing `persons` rows must survive: the migration may only add nullable `account_id` plus its index/FK.
- Missing `Currency` and generic `User` models must not produce invented relations or tables; both IDs remain nullable scalar columns.
- Financial parent records must not cascade-delete when accounts, registers, schools, items, years, or classes are deleted.
- Decimal precision must remain consistent: money `18,2`, rate `18,6`, quantity `18,3`.
- Re-running the lookup seed must preserve exactly one row for every required register type and item type.

---

## File structure

- Create `src/database/accounting-phase-1.schema.spec.ts`: static contract tests for the Prisma schema and lookup seed.
- Modify `prisma/schema.prisma`: approved models, fields, mappings, relations, indexes, and existing-model reverse relations.
- Modify `src/database/seed/seed-lookups.ts`: typed lookup client members and idempotent accounting/item type upserts.
- Create `prisma/migrations/*_add_accounting_phase_1/migration.sql`: Prisma-generated PostgreSQL migration, retained only after destructive-SQL review passes.

### Task 1: Add the failing Accounting Phase 1 contract test

**Files:**
- Create: `src/database/accounting-phase-1.schema.spec.ts`
- Read: `prisma/schema.prisma`
- Read: `src/database/seed/seed-lookups.ts`

**Interfaces:**
- Consumes: the repository files at `prisma/schema.prisma` and `src/database/seed/seed-lookups.ts`.
- Produces: Jest assertions that fail until every approved model, mapping, critical type, relation, and seed value exists.

- [ ] **Step 1: Create the schema/seed contract test**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const lookupSeed = readFileSync(
  resolve(process.cwd(), 'src/database/seed/seed-lookups.ts'),
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

describe('Accounting Phase 1 Prisma contract', () => {
  const mappedModels = {
    AccountingRegisterType: 'accounting_register_types',
    Account: 'accounts',
    AccountingRegister: 'accounting_register',
    AccountingDaily: 'accounting_daily',
    AccountingReceipt: 'accounting_receipts',
    AccountingPayment: 'accounting_payments',
    AccountingSale: 'accounting_sales',
    AccountingPurchase: 'accounting_purchase',
    AccountingSalesReturn: 'accounting_sales_return',
    AccountingPurchaseReturn: 'accounting_purchase_return',
    AccountingInvoice: 'accounting_invoice',
    AccountingInvoiceDetail: 'accounting_invoice_details',
    ItemType: 'item_types',
    Item: 'items',
    AccountingRegistrationPackage: 'accounting_registration_package',
    AccountingRegistrationPackageItem:
      'accounting_registration_package_items',
    AccountingRegistrationPackageClass:
      'accounting_registration_package_classes',
    Installment: 'installment',
  } as const;

  it.each(Object.entries(mappedModels))(
    'maps %s to %s',
    (modelName, tableName) => {
      expect(modelBlock(modelName)).toContain(`@@map("${tableName}")`);
    },
  );

  it('adds nullable persons.account_id with a restrictive Account relation', () => {
    const person = modelBlock('Person');
    expect(person).toMatch(/accountId\s+Int\?\s+@map\("account_id"\)/);
    expect(person).toMatch(
      /account\s+Account\?\s+@relation\(fields: \[accountId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(person).toContain('@@index([accountId])');
  });

  it('keeps Account business columns limited to id and unique code', () => {
    const account = modelBlock('Account');
    expect(account).toMatch(/id\s+Int\s+@id\s+@default\(autoincrement\(\)\)/);
    expect(account).toMatch(/code\s+String\s+@unique\s+@db\.VarChar\(255\)/);
    expect(account).not.toMatch(/schoolId|name\s+String|typeId|currencyId/);
  });

  it('keeps currencyId and userId nullable and relation-free', () => {
    const register = modelBlock('AccountingRegister');
    const installment = modelBlock('Installment');
    const packageItem = modelBlock('AccountingRegistrationPackageItem');
    expect(register).toMatch(/currencyId\s+Int\?\s+@map\("currency_id"\)/);
    expect(register).toMatch(/userId\s+Int\?\s+@map\("user_id"\)/);
    expect(installment).toMatch(/userId\s+Int\?\s+@map\("user_id"\)/);
    expect(packageItem).toMatch(/currencyId\s+Int\?\s+@map\("currency_id"\)/);
    expect(schema).not.toMatch(/model Currency\s+\{/);
    expect(schema).not.toMatch(/model User\s+\{/);
  });

  it('uses the approved decimal precision', () => {
    expect(modelBlock('AccountingRegister')).toMatch(
      /currencyRate\s+Decimal\?\s+@map\("currency_rate"\)\s+@db\.Decimal\(18, 6\)/,
    );
    for (const field of ['debit', 'credit']) {
      expect(modelBlock('AccountingDaily')).toMatch(
        new RegExp(`${field}\\s+Decimal\\s+@db\\.Decimal\\(18, 2\\)`),
      );
    }
    const detail = modelBlock('AccountingInvoiceDetail');
    expect(detail).toMatch(/unitPrice\s+Decimal\s+.*@db\.Decimal\(18, 2\)/);
    expect(detail).toMatch(/quantity\s+Decimal\s+@db\.Decimal\(18, 3\)/);
    for (const field of ['discount', 'tax']) {
      expect(detail).toMatch(
        new RegExp(`${field}\\s+Decimal\\s+@db\\.Decimal\\(18, 2\\)`),
      );
    }
    expect(modelBlock('Installment')).toMatch(
      /amount\s+Decimal\s+@db\.Decimal\(18, 2\)/,
    );
  });

  it('does not add premature document-number uniqueness', () => {
    for (const modelName of [
      'AccountingReceipt',
      'AccountingPayment',
      'AccountingSale',
      'AccountingPurchase',
      'AccountingSalesReturn',
      'AccountingPurchaseReturn',
    ]) {
      const model = modelBlock(modelName);
      expect(model).toMatch(/nb\s+Int/);
      expect(model).not.toMatch(/nb\s+Int\s+@unique/);
      expect(model).not.toMatch(/@@unique\([^\n]*nb/);
    }
  });
});

describe('Accounting Phase 1 lookup seed contract', () => {
  it.each([
    'Receipt',
    'Payment',
    'Sales',
    'Purchase',
    'Sales Return',
    'Purchase Return',
    'Product',
    'Services',
  ])('contains idempotent lookup value %s', (name) => {
    expect(lookupSeed).toContain(`'${name}'`);
  });

  it('upserts both accounting lookup families', () => {
    expect(lookupSeed).toContain('prisma.accountingRegisterType.upsert');
    expect(lookupSeed).toContain('prisma.itemType.upsert');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- --runInBand src/database/accounting-phase-1.schema.spec.ts
```

Expected: FAIL with `Missing Prisma model AccountingRegisterType`; this proves the test is observing the absent Phase 1 schema.

- [ ] **Step 3: Commit the red test**

```bash
git add src/database/accounting-phase-1.schema.spec.ts
git commit -m "test: define accounting phase 1 schema contract"
```

### Task 2: Implement the approved Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `src/database/accounting-phase-1.schema.spec.ts`

**Interfaces:**
- Consumes: the schema contract from Task 1 and existing `School`, `Person`, `Year`, and `Class` models.
- Produces: Prisma models and reverse relations that `prisma validate` can resolve.

- [ ] **Step 1: Add reverse relations to existing models**

Add to `School`:

```prisma
  accountingRegisters AccountingRegister[]
  items               Item[]
```

Add to `Person`, next to its identity fields and relations:

```prisma
  accountId Int? @map("account_id")

  account Account? @relation(fields: [accountId], references: [id], onDelete: Restrict)

  @@index([accountId])
```

Add to `Year`:

```prisma
  accountingRegistrationPackages AccountingRegistrationPackage[]
  installments                   Installment[]
```

Add to `Class`:

```prisma
  accountingRegistrationPackageClasses AccountingRegistrationPackageClass[]
```

- [ ] **Step 2: Add the approved lookup, account, register, daily, and document models**

Append these models to `prisma/schema.prisma`:

```prisma
model AccountingRegisterType {
  id   Int    @id @default(autoincrement())
  name String @unique @db.VarChar(255)

  registers AccountingRegister[]

  @@map("accounting_register_types")
}

model Account {
  id   Int    @id @default(autoincrement())
  code String @unique @db.VarChar(255)

  persons      Person[]
  dailyEntries AccountingDaily[]
  installments Installment[]

  @@map("accounts")
}

model AccountingRegister {
  id                       Int      @id @default(autoincrement())
  description              String?  @db.Text
  dateCreated              DateTime @default(now()) @map("date_created") @db.Timestamptz(6)
  accountingRegisterTypeId Int      @map("accounting_register_type_id")
  currencyId               Int?     @map("currency_id")
  notes                     String?  @db.Text
  comments                  String?  @db.Text
  currencyRate              Decimal? @map("currency_rate") @db.Decimal(18, 6)
  schoolId                  Int      @map("school_id")
  userId                    Int?     @map("user_id")

  accountingRegisterType AccountingRegisterType @relation(fields: [accountingRegisterTypeId], references: [id], onDelete: Restrict)
  school                School                 @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  dailyEntries          AccountingDaily[]
  receipts              AccountingReceipt[]
  payments              AccountingPayment[]
  sales                 AccountingSale[]
  purchases             AccountingPurchase[]
  salesReturns          AccountingSalesReturn[]
  purchaseReturns       AccountingPurchaseReturn[]
  invoices              AccountingInvoice[]

  @@index([accountingRegisterTypeId])
  @@index([schoolId])
  @@map("accounting_register")
}

model AccountingDaily {
  id                   Int     @id @default(autoincrement())
  accountId            Int     @map("account_id")
  debit                Decimal @db.Decimal(18, 2)
  credit               Decimal @db.Decimal(18, 2)
  description          String? @db.Text
  accountingRegisterId Int     @map("accounting_register_id")

  account            Account            @relation(fields: [accountId], references: [id], onDelete: Restrict)
  accountingRegister AccountingRegister @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)

  @@index([accountId])
  @@index([accountingRegisterId])
  @@map("accounting_daily")
}

model AccountingReceipt {
  id                   Int @id @default(autoincrement())
  accountingRegisterId Int @map("accounting_register_id")
  nb                   Int

  accountingRegister AccountingRegister @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)
  installments       Installment[]

  @@index([accountingRegisterId])
  @@map("accounting_receipts")
}

model AccountingPayment {
  id                   Int @id @default(autoincrement())
  accountingRegisterId Int @map("accounting_register_id")
  nb                   Int

  accountingRegister AccountingRegister @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)

  @@index([accountingRegisterId])
  @@map("accounting_payments")
}

model AccountingSale {
  id                   Int @id @default(autoincrement())
  accountingRegisterId Int @map("accounting_register_id")
  nb                   Int

  accountingRegister AccountingRegister @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)

  @@index([accountingRegisterId])
  @@map("accounting_sales")
}

model AccountingPurchase {
  id                   Int @id @default(autoincrement())
  accountingRegisterId Int @map("accounting_register_id")
  nb                   Int

  accountingRegister AccountingRegister @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)

  @@index([accountingRegisterId])
  @@map("accounting_purchase")
}

model AccountingSalesReturn {
  id                   Int @id @default(autoincrement())
  accountingRegisterId Int @map("accounting_register_id")
  nb                   Int

  accountingRegister AccountingRegister @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)

  @@index([accountingRegisterId])
  @@map("accounting_sales_return")
}

model AccountingPurchaseReturn {
  id                   Int @id @default(autoincrement())
  accountingRegisterId Int @map("accounting_register_id")
  nb                   Int

  accountingRegister AccountingRegister @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)

  @@index([accountingRegisterId])
  @@map("accounting_purchase_return")
}
```

- [ ] **Step 3: Add invoice, item, package, and installment models**

```prisma
model AccountingInvoice {
  id                   Int      @id @default(autoincrement())
  dateCreated          DateTime @default(now()) @map("date_created") @db.Timestamptz(6)
  description          String?  @db.Text
  accountingRegisterId Int      @map("accounting_register_id")
  tax                  Decimal  @db.Decimal(18, 2)
  discount             Decimal  @db.Decimal(18, 2)
  total                Decimal  @db.Decimal(18, 2)

  accountingRegister AccountingRegister         @relation(fields: [accountingRegisterId], references: [id], onDelete: Restrict)
  details            AccountingInvoiceDetail[]

  @@index([accountingRegisterId])
  @@map("accounting_invoice")
}

model AccountingInvoiceDetail {
  id          Int     @id @default(autoincrement())
  invoiceId   Int     @map("invoice_id")
  itemId      Int     @map("item_id")
  unitPrice   Decimal @map("unit_price") @db.Decimal(18, 2)
  quantity    Decimal @db.Decimal(18, 3)
  description String? @db.Text
  discount    Decimal @db.Decimal(18, 2)
  tax         Decimal @db.Decimal(18, 2)

  invoice AccountingInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  item    Item              @relation(fields: [itemId], references: [id], onDelete: Restrict)

  @@index([invoiceId])
  @@index([itemId])
  @@map("accounting_invoice_details")
}

model ItemType {
  id   Int    @id @default(autoincrement())
  name String @unique @db.VarChar(255)

  items Item[]

  @@map("item_types")
}

model Item {
  id         Int      @id @default(autoincrement())
  name       String   @db.VarChar(255)
  schoolId   Int      @map("school_id")
  itemTypeId Int      @map("item_type_id")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  school                   School                              @relation(fields: [schoolId], references: [id], onDelete: Restrict)
  itemType                 ItemType                            @relation(fields: [itemTypeId], references: [id], onDelete: Restrict)
  invoiceDetails           AccountingInvoiceDetail[]
  registrationPackageItems AccountingRegistrationPackageItem[]

  @@index([schoolId])
  @@index([itemTypeId])
  @@map("items")
}

model AccountingRegistrationPackage {
  id          Int      @id @default(autoincrement())
  name        String   @db.VarChar(255)
  yearId      Int      @map("year_id")
  dateCreated DateTime @default(now()) @map("date_created") @db.Timestamptz(6)

  year    Year                                 @relation(fields: [yearId], references: [id], onDelete: Restrict)
  items   AccountingRegistrationPackageItem[]
  classes AccountingRegistrationPackageClass[]

  @@index([yearId])
  @@map("accounting_registration_package")
}

model AccountingRegistrationPackageItem {
  id                              Int      @id @default(autoincrement())
  itemId                          Int      @map("item_id")
  price                           Decimal  @db.Decimal(18, 2)
  mandatory                       Boolean
  accountingRegistrationPackageId Int      @map("accounting_registration_package_id")
  dateCreated                     DateTime @default(now()) @map("date_created") @db.Timestamptz(6)
  currencyId                      Int?     @map("currency_id")

  item                          Item                          @relation(fields: [itemId], references: [id], onDelete: Restrict)
  accountingRegistrationPackage AccountingRegistrationPackage @relation(fields: [accountingRegistrationPackageId], references: [id], onDelete: Restrict)

  @@index([itemId])
  @@index([accountingRegistrationPackageId])
  @@map("accounting_registration_package_items")
}

model AccountingRegistrationPackageClass {
  id                              Int      @id @default(autoincrement())
  accountingRegistrationPackageId Int      @map("accounting_registration_package_id")
  classId                         Int      @map("class_id")
  dateCreated                     DateTime @default(now()) @map("date_created") @db.Timestamptz(6)

  accountingRegistrationPackage AccountingRegistrationPackage @relation(fields: [accountingRegistrationPackageId], references: [id], onDelete: Restrict)
  class                         Class                         @relation(fields: [classId], references: [id], onDelete: Restrict)

  @@index([accountingRegistrationPackageId])
  @@index([classId])
  @@map("accounting_registration_package_classes")
}

model Installment {
  id          Int       @id @default(autoincrement())
  accountId   Int       @map("account_id")
  paid        Boolean   @default(false)
  receiptId   Int       @map("receipt_id")
  amount      Decimal   @db.Decimal(18, 2)
  yearId      Int       @map("year_id")
  date        DateTime? @db.Date
  dateCreated DateTime  @default(now()) @map("date_created") @db.Timestamptz(6)
  userId      Int?      @map("user_id")

  account Account           @relation(fields: [accountId], references: [id], onDelete: Restrict)
  receipt AccountingReceipt @relation(fields: [receiptId], references: [id], onDelete: Restrict)
  year    Year              @relation(fields: [yearId], references: [id], onDelete: Restrict)

  @@index([accountId])
  @@index([receiptId])
  @@index([yearId])
  @@map("installment")
}
```

- [ ] **Step 4: Format and validate the Prisma schema**

Run:

```bash
npx prisma format
npx prisma validate
```

Expected: both commands exit 0. If Prisma reports a missing opposite relation or invalid native type, correct only the named schema issue and rerun both commands.

- [ ] **Step 5: Run the focused contract test**

Run:

```bash
npm test -- --runInBand src/database/accounting-phase-1.schema.spec.ts
```

Expected: model/type assertions pass; seed assertions still fail because Task 3 has not changed the seed.

- [ ] **Step 6: Commit the schema change**

```bash
git add prisma/schema.prisma
git commit -m "feat: add accounting phase 1 prisma models"
```

### Task 3: Extend the idempotent lookup seed

**Files:**
- Modify: `src/database/seed/seed-lookups.ts`
- Test: `src/database/accounting-phase-1.schema.spec.ts`

**Interfaces:**
- Consumes: Prisma Client accessors generated from Task 2's `AccountingRegisterType` and `ItemType` models.
- Produces: `seedLookups(prisma)` upserts all six register types and both item types by unique name.

- [ ] **Step 1: Add lookup client types**

Add to `LookupPrisma`:

```ts
  accountingRegisterType: {
    upsert: (args: {
      where: { name: string };
      create: { name: string };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
  itemType: {
    upsert: (args: {
      where: { name: string };
      create: { name: string };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
```

- [ ] **Step 2: Add idempotent accounting lookup upserts**

Append inside `seedLookups`:

```ts
  for (const name of [
    'Receipt',
    'Payment',
    'Sales',
    'Purchase',
    'Sales Return',
    'Purchase Return',
  ]) {
    await prisma.accountingRegisterType.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  for (const name of ['Product', 'Services']) {
    await prisma.itemType.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
```

- [ ] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
npm test -- --runInBand src/database/accounting-phase-1.schema.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Generate Prisma Client and run the TypeScript build**

Run:

```bash
npx prisma generate
npm run build
```

Expected: both commands exit 0 and `seedLookups` accepts the generated Prisma client structurally.

- [ ] **Step 5: Commit the seed change**

```bash
git add src/database/seed/seed-lookups.ts
git commit -m "feat: seed accounting lookup types"
```

### Task 4: Generate and safety-review the migration

**Files:**
- Create: `prisma/migrations/*_add_accounting_phase_1/migration.sql`
- Compare: `prisma/schema.prisma`

**Interfaces:**
- Consumes: validated Prisma schema from Task 2 and the configured development `DATABASE_URL`.
- Produces: reviewed SQL that only creates approved objects and adds nullable `persons.account_id`.

- [ ] **Step 1: Confirm the database target without printing credentials**

Run:

```bash
node -e "const u=new URL(process.env.DATABASE_URL); console.log({protocol:u.protocol,host:u.host,database:u.pathname.slice(1)})"
```

Expected: a PostgreSQL URL and the intended development host/database. Stop if it is production or cannot be positively identified as development.

- [ ] **Step 2: Generate the migration without applying it**

Run:

```bash
npx prisma migrate dev --name add_accounting_phase_1 --create-only
```

Expected: one new migration directory ending in `_add_accounting_phase_1`; no migration is applied by this command.

- [ ] **Step 3: Inspect the entire generated SQL**

Run:

```bash
find prisma/migrations -maxdepth 1 -type d -name '*_add_accounting_phase_1' -print
sed -n '1,999p' prisma/migrations/*_add_accounting_phase_1/migration.sql
```

The SQL must contain exactly these structural actions:

- `ALTER TABLE "persons" ADD COLUMN "account_id" INTEGER` with no `NOT NULL` or default.
- 18 approved `CREATE TABLE` statements.
- Unique indexes for account code, accounting register type name, and item type name.
- Indexes for the planned foreign-key columns.
- Foreign keys using `ON DELETE RESTRICT`, except invoice detail → invoice using `ON DELETE CASCADE`.
- No foreign keys for any `currency_id` or `user_id` column.

It must not contain any of these destructive operations:

```text
DROP TABLE
DROP COLUMN
TRUNCATE
DELETE FROM
UPDATE "persons"
ALTER COLUMN ... SET NOT NULL
```

- [ ] **Step 4: Run a mechanical destructive-SQL guard**

Run:

```bash
if rg -n 'DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE "persons"|ALTER COLUMN.*SET NOT NULL' prisma/migrations/*_add_accounting_phase_1/migration.sql; then
  echo 'Unsafe migration SQL detected' >&2
  exit 1
fi
```

Expected: exit 0 with no matches. If it fails, do not apply the migration; fix the schema/migration generation cause and repeat Task 4 from Step 2.

- [ ] **Step 5: Apply the reviewed migration**

Run:

```bash
npx prisma migrate dev
```

Expected: Prisma applies the pending `add_accounting_phase_1` migration successfully and reports the development database in sync.

- [ ] **Step 6: Verify migration status**

Run:

```bash
npx prisma migrate status
```

Expected: database schema is up to date and `add_accounting_phase_1` is applied.

- [ ] **Step 7: Commit the reviewed migration**

```bash
git add prisma/migrations/*_add_accounting_phase_1/migration.sql
git commit -m "feat: migrate accounting phase 1 foundation"
```

### Task 5: Generate, build, seed, and verify the applied database

**Files:**
- Verify: `prisma/schema.prisma`
- Verify: `src/database/seed/seed-lookups.ts`
- Verify: `prisma/migrations/*_add_accounting_phase_1/migration.sql`

**Interfaces:**
- Consumes: applied development migration and compiled lookup seed.
- Produces: generated Prisma Client, compiled backend, persisted lookup rows, and direct PostgreSQL evidence.

- [ ] **Step 1: Generate and validate the final Prisma schema**

Run:

```bash
npx prisma generate
npx prisma validate
```

Expected: both commands exit 0.

- [ ] **Step 2: Run the focused test and complete backend test suite**

Run:

```bash
npm test -- --runInBand src/database/accounting-phase-1.schema.spec.ts
npm test -- --runInBand
```

Expected: the focused test and full Jest suite pass. Report any unrelated pre-existing failure by test name; do not hide or automatically rewrite unrelated code.

- [ ] **Step 3: Build/type-check the backend**

Run:

```bash
npm run build
```

Expected: `prisma generate` and `nest build` exit 0.

- [ ] **Step 4: Run the idempotent lookup seed twice**

Run:

```bash
npm run prisma:seed:lookups
npm run prisma:seed:lookups
```

Expected: both executions succeed without unique-constraint errors or duplicate rows.

- [ ] **Step 5: Verify tables and `persons.account_id` directly in PostgreSQL**

Run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'accounting_register_types', 'accounts', 'accounting_register',
    'accounting_daily', 'accounting_receipts', 'accounting_payments',
    'accounting_sales', 'accounting_purchase', 'accounting_sales_return',
    'accounting_purchase_return', 'accounting_invoice',
    'accounting_invoice_details', 'item_types', 'items',
    'accounting_registration_package',
    'accounting_registration_package_items',
    'accounting_registration_package_classes', 'installment'
  )
ORDER BY table_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'persons'
  AND column_name = 'account_id';
SQL
```

Expected: 18 table rows and one nullable integer `account_id` row.

- [ ] **Step 6: Verify accounting foreign keys and delete actions**

Run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.constraint_schema = ccu.constraint_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
 AND tc.constraint_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (
    tc.table_name LIKE 'accounting_%'
    OR tc.table_name IN ('persons', 'items', 'installment')
  )
ORDER BY tc.table_name, kcu.column_name;
SQL
```

Expected: all planned foreign keys are present; delete rules are `RESTRICT` except `accounting_invoice_details.invoice_id`, which is `CASCADE`. No `currency_id` or `user_id` foreign key exists.

- [ ] **Step 7: Verify indexes and lookup rows**

Run:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'accounting_%'
    OR tablename IN ('accounts', 'persons', 'item_types', 'items', 'installment')
  )
ORDER BY tablename, indexname;

SELECT name
FROM accounting_register_types
ORDER BY name;

SELECT name
FROM item_types
ORDER BY name;

SELECT name, COUNT(*)
FROM accounting_register_types
GROUP BY name
HAVING COUNT(*) <> 1;

SELECT name, COUNT(*)
FROM item_types
GROUP BY name
HAVING COUNT(*) <> 1;
SQL
```

Expected:

- Required FK/unique indexes are listed, including the `persons.account_id` index.
- Register types are Payment, Purchase, Purchase Return, Receipt, Sales, Sales Return.
- Item types are Product and Services.
- Both duplicate-detection queries return zero rows.

- [ ] **Step 8: Review the final diff and confirm scope**

Run:

```bash
git diff f92901e^ --check
git diff f92901e^ --stat
git status --short
```

Expected: only the contract test, Prisma schema, lookup seed, migration, and planning/spec documentation changed. No frontend, controller, service, posting, numbering, or Phase 2 files are present.

- [ ] **Step 9: Record final evidence**

The final report must list:

1. Prisma models created and existing models modified.
2. Exact PostgreSQL tables, foreign keys, indexes, decimal precision, and nullable columns.
3. Migration directory/path and confirmation that its reviewed SQL was non-destructive.
4. Lookup seed additions and successful second idempotency run.
5. Every command actually executed and its result.
6. Results from Prisma generate/validate, focused/full tests, and backend build.
7. Results from direct PostgreSQL table/column/FK/index/seed verification.
8. Every deviation from the approved schema, or an explicit statement that there were none.

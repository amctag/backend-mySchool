import { readFileSync } from 'node:fs';
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
    AccountingRegistrationPackageItem: 'accounting_registration_package_items',
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

  it('extends Account with name and controlled type (Phase 2B)', () => {
    const account = modelBlock('Account');
    expect(account).toMatch(/id\s+Int\s+@id\s+@default\(autoincrement\(\)\)/);
    expect(account).toMatch(/code\s+String\s+@unique\s+@db\.VarChar\(255\)/);
    expect(account).toMatch(/name\s+String\s+@db\.VarChar\(255\)/);
    expect(account).toMatch(/type\s+AccountType/);
    expect(schema).toMatch(
      /enum AccountType \{[\s\S]*?PERSON[\s\S]*?CASH[\s\S]*?SALES[\s\S]*?PURCHASES/,
    );
  });

  it('keeps currencyId and userId nullable and relation-free', () => {
    expect(modelBlock('AccountingRegister')).toMatch(
      /currencyId\s+Int\?\s+@map\("currency_id"\)/,
    );
    expect(modelBlock('AccountingRegister')).toMatch(
      /userId\s+Int\?\s+@map\("user_id"\)/,
    );
    expect(modelBlock('Installment')).toMatch(
      /userId\s+Int\?\s+@map\("user_id"\)/,
    );
    expect(modelBlock('AccountingRegistrationPackageItem')).toMatch(
      /currencyId\s+Int\?\s+@map\("currency_id"\)/,
    );
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

  it('scopes receipt/payment numbering per school with uniqueness (Phase 2B)', () => {
    for (const modelName of ['AccountingReceipt', 'AccountingPayment']) {
      const model = modelBlock(modelName);
      expect(model).toMatch(/nb\s+Int/);
      expect(model).toMatch(/schoolId\s+Int\s+@map\("school_id"\)/);
      expect(model).toMatch(/@@unique\(\[schoolId, nb\]\)/);
    }
    for (const modelName of [
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

  it('adds school-scoped document counters and register idempotency keys (Phase 2B)', () => {
    const counter = modelBlock('AccountingDocumentCounter');
    expect(counter).toContain('@@map("accounting_document_counters")');
    expect(counter).toMatch(/schoolId\s+Int\s+@map\("school_id"\)/);
    expect(counter).toMatch(
      /accountingRegisterTypeId\s+Int\s+@map\("accounting_register_type_id"\)/,
    );
    expect(counter).toMatch(/lastNb\s+Int\s+@default\(0\)\s+@map\("last_nb"\)/);
    expect(modelBlock('AccountingRegister')).toMatch(
      /idempotencyKey\s+String\?\s+@map\("idempotency_key"\)/,
    );
  });
});

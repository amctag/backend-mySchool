import { Prisma } from '@prisma/client';
import { DashboardAccountingService } from './dashboard-accounting.service';

const usdCurrency = {
  id: 1,
  title: 'US Dollar',
  shortCode: 'USD',
  symbol: '$',
  rate: '1',
};

const lbpCurrency = {
  id: 2,
  title: 'Lebanese Pound',
  shortCode: 'LBP',
  symbol: 'LBP',
  rate: '89500',
};

function recordTransaction(overrides?: {
  queryRawResults?: unknown[];
  accounts?: unknown[];
  currency?: unknown;
  registerType?: { id: number } | null;
  registerCreate?: { id: number };
  registerFindFirst?: unknown;
  recordCreate?: unknown;
  dailyRows?: Array<{ accountId: number; debit: unknown; credit: unknown }>;
}) {
  const queue = [...(overrides?.queryRawResults ?? [])];
  const tx = {
    $queryRaw: jest.fn(() => {
      const next = queue.shift();
      if (next instanceof Error) {
        throw next;
      }
      return Promise.resolve(next);
    }),
    account: {
      findMany: jest.fn(() => Promise.resolve(overrides?.accounts ?? [])),
    },
    currency: {
      findUnique: jest.fn(() => Promise.resolve(overrides?.currency ?? null)),
    },
    accountingRegisterType: {
      findUnique: jest.fn(() =>
        Promise.resolve(overrides?.registerType ?? { id: 8 }),
      ),
    },
    accountingRegister: {
      create: jest.fn(() =>
        Promise.resolve(
          overrides?.registerCreate ?? {
            id: 600,
            dateCreated: new Date('2026-09-30T10:00:00.000Z'),
          },
        ),
      ),
      findFirst: jest.fn(() =>
        Promise.resolve(overrides?.registerFindFirst ?? null),
      ),
    },
    accountingRecord: {
      create: jest.fn(() =>
        Promise.resolve(overrides?.recordCreate ?? { id: 50 }),
      ),
    },
    accountingDaily: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      findMany: jest.fn(() => Promise.resolve(overrides?.dailyRows ?? [])),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (t: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const service = new DashboardAccountingService(prisma as never);
  return { tx, service };
}

const cash = { id: 31 };
const sales = { id: 55 };
const parentAccount = { id: 12 };

function validMocks() {
  return recordTransaction({
    queryRawResults: [[{ nb: 1 }]],
    accounts: [
      { id: 31 },
      { id: 32 },
      { id: 33 },
      { id: 55 },
      { id: 56 },
      { id: 12 },
    ],
    currency: usdCurrency,
    dailyRows: [],
  });
}

describe('Manual Record posting', () => {
  it('posts 500+1000+300 debit against 1800 credit as one register and one record', async () => {
    const { tx, service } = validMocks();
    tx.accountingDaily.findMany.mockResolvedValue([
      { accountId: 31, debit: '500.00', credit: '0' },
      { accountId: 32, debit: '1000.00', credit: '0' },
      { accountId: 33, debit: '300.00', credit: '0' },
      { accountId: 55, debit: '0', credit: '1800.00' },
    ]);
    jest.spyOn(service, 'getRecord').mockResolvedValue({ id: 50 } as never);

    await service.createRecord({ schoolId: 3 } as never, {
      currencyId: 1,
      rows: [
        { accountId: 31, debit: 500 },
        { accountId: 32, debit: 1000 },
        { accountId: 33, debit: 300 },
        { accountId: 55, credit: 1800 },
      ],
    });

    expect(tx.accountingRegister.create).toHaveBeenCalledTimes(1);
    expect(tx.accountingRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nb: 1, schoolId: 3 }),
      }),
    );
    expect(
      tx.accountingDaily.createMany.mock.calls[0][0].data,
    ).toHaveLength(4);
  });

  it('accepts split credits 1000+800 against the same debits', async () => {
    const { tx, service } = validMocks();
    tx.accountingDaily.findMany.mockResolvedValue([
      { accountId: 31, debit: '500.00', credit: '0' },
      { accountId: 32, debit: '1000.00', credit: '0' },
      { accountId: 33, debit: '300.00', credit: '0' },
      { accountId: 55, debit: '0', credit: '1000.00' },
      { accountId: 56, debit: '0', credit: '800.00' },
    ]);
    jest.spyOn(service, 'getRecord').mockResolvedValue({ id: 51 } as never);

    await service.createRecord({ schoolId: 3 } as never, {
      currencyId: 1,
      rows: [
        { accountId: 31, debit: 500 },
        { accountId: 32, debit: 1000 },
        { accountId: 33, debit: 300 },
        { accountId: 55, credit: 1000 },
        { accountId: 56, credit: 800 },
      ],
    });

    expect(tx.accountingRecord.create).toHaveBeenCalledTimes(1);
    expect(
      tx.accountingDaily.createMany.mock.calls[0][0].data,
    ).toHaveLength(5);
  });

  it('rejects an unbalanced record without creating anything', async () => {
    const { tx, service } = validMocks();
    await expect(
      service.createRecord({ schoolId: 3 } as never, {
        currencyId: 1,
        rows: [
          { accountId: 31, debit: 1800 },
          { accountId: 55, credit: 1700 },
        ],
      }),
    ).rejects.toThrow('out of balance');
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
    expect(tx.accountingRecord.create).not.toHaveBeenCalled();
  });

  it('rejects a row carrying both debit and credit', async () => {
    const { tx, service } = validMocks();
    await expect(
      service.createRecord({ schoolId: 3 } as never, {
        currencyId: 1,
        rows: [
          { accountId: 31, debit: 500, credit: 500 },
          { accountId: 55, credit: 500 },
        ],
      }),
    ).rejects.toThrow('cannot both be set');
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects an all-zero row', async () => {
    const { tx, service } = validMocks();
    await expect(
      service.createRecord({ schoolId: 3 } as never, {
        currencyId: 1,
        rows: [
          { accountId: 31, debit: 500 },
          { accountId: 55 },
        ],
      }),
    ).rejects.toThrow('must be positive');
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects a cross-school account', async () => {
    const { tx, service } = recordTransaction({
      accounts: [{ id: 31 }],
      currency: usdCurrency,
    });
    await expect(
      service.createRecord({ schoolId: 3 } as never, {
        currencyId: 1,
        rows: [
          { accountId: 31, debit: 500 },
          { accountId: 999, credit: 500 },
        ],
      }),
    ).rejects.toThrow('does not belong to the authenticated school');
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('returns the original record on idempotent retry', async () => {
    const { tx, service } = validMocks();
    tx.accountingRegister.findFirst.mockResolvedValue({
      records: [{ id: 50 }],
    });
    jest.spyOn(service, 'getRecord').mockResolvedValue({ id: 50 } as never);

    const result = await service.createRecord({ schoolId: 3 } as never, {
      currencyId: 1,
      rows: [
        { accountId: 31, debit: 500 },
        { accountId: 55, credit: 500 },
      ],
      idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(result).toEqual({ id: 50 });
    expect(tx.accountingRecord.create).not.toHaveBeenCalled();
  });
});

function statementRow(
  id: number,
  registerId: number,
  date: string,
  debit: string,
  credit: string,
  register: Record<string, unknown>,
) {
  return {
    id,
    debit,
    credit,
    description: null,
    accountingRegisterId: registerId,
    accountingRegister: {
      id: registerId,
      dateCreated: new Date(date),
      description: 'Test entry',
      currencyId: 1,
      currency: usdCurrency,
      accountingRegisterType: { name: 'Invoice' },
      receipts: [],
      payments: [],
      invoices: [],
      records: [],
      ...register,
    },
  };
}

function statementService(rangeRows: unknown[], preRows: unknown[] = []) {
  const prisma = {
    account: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: 12,
          code: '100001',
          name: 'Maya Joseph Hassan',
          type: 'PERSON',
        }),
      ),
    },
    $queryRaw: jest.fn(() => Promise.resolve(preRows)),
    accountingDaily: {
      findMany: jest.fn(() => Promise.resolve(rangeRows)),
    },
  };
  return {
    prisma,
    service: new DashboardAccountingService(prisma as never),
  };
}

const invoiceReg = (nb: number) => ({
  accountingRegisterType: { name: 'Invoice' },
  invoices: [{ id: 900 + nb, nb }],
});
const receiptReg = (nb: number) => ({
  accountingRegisterType: { name: 'Receipt' },
  receipts: [{ id: 10 + nb, nb }],
});

describe('Statement of account', () => {
  it('computes running balances credit-minus-debit across documents', async () => {
    const { service } = statementService([
      statementRow(1, 500, '2026-09-28T10:00:00.000Z', '150.00', '0', invoiceReg(1)),
      statementRow(2, 501, '2026-09-29T10:00:00.000Z', '0', '150.00', receiptReg(1)),
      statementRow(3, 502, '2026-09-30T10:00:00.000Z', '300.00', '0', invoiceReg(2)),
      statementRow(4, 503, '2026-10-01T10:00:00.000Z', '0', '100.00', receiptReg(2)),
    ]);

    const statement = await service.getAccountStatement(
      { schoolId: 3 } as never,
      12,
      { accountId: 12, page: 1, limit: 50 },
    );

    expect(statement.rows.map((row) => row.balance)).toEqual([
      '-150.00',
      '0.00',
      '-300.00',
      '-200.00',
    ]);
    expect(statement.rows[0]).toEqual(
      expect.objectContaining({ documentType: 'Invoice', documentNb: 1 }),
    );
    expect(statement.summaries).toEqual([
      expect.objectContaining({
        shortCode: 'USD',
        totalDebit: '450.00',
        totalCredit: '250.00',
        closingBalance: '-200.00',
      }),
    ]);
  });

  it('keeps running balances correct on later pages', async () => {
    const { service } = statementService([
      statementRow(1, 500, '2026-09-28T10:00:00.000Z', '150.00', '0', invoiceReg(1)),
      statementRow(2, 501, '2026-09-29T10:00:00.000Z', '0', '150.00', receiptReg(1)),
      statementRow(3, 502, '2026-09-30T10:00:00.000Z', '300.00', '0', invoiceReg(2)),
      statementRow(4, 503, '2026-10-01T10:00:00.000Z', '0', '100.00', receiptReg(2)),
    ]);

    const statement = await service.getAccountStatement(
      { schoolId: 3 } as never,
      12,
      { accountId: 12, page: 2, limit: 2 },
    );

    expect(statement.rows.map((row) => row.balance)).toEqual([
      '-300.00',
      '-200.00',
    ]);
    expect(statement.total).toBe(4);
    expect(statement.totalPages).toBe(2);
  });

  it('starts from the pre-filter opening balance for date ranges', async () => {
    const { prisma, service } = statementService(
      [
        statementRow(3, 502, '2026-09-30T10:00:00.000Z', '300.00', '0', invoiceReg(2)),
      ],
      [{ currencyId: 1, debit: '150.00', credit: '150.00' }],
    );

    const statement = await service.getAccountStatement(
      { schoolId: 3 } as never,
      12,
      { accountId: 12, dateFrom: '2026-09-30', page: 1, limit: 50 },
    );

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(statement.rows.map((row) => row.balance)).toEqual(['-300.00']);
    expect(statement.summaries[0]).toEqual(
      expect.objectContaining({ openingBalance: '0.00' }),
    );
  });

  it('groups totals by currency without mixing them', async () => {
    const lbpRow = statementRow(
      5,
      504,
      '2026-10-02T10:00:00.000Z',
      '89500.000',
      '0',
      {
        accountingRegisterType: { name: 'Invoice' },
        invoices: [{ id: 905, nb: 3 }],
      },
    );
    lbpRow.accountingRegister.currencyId = 2;
    lbpRow.accountingRegister.currency = lbpCurrency;
    const { service } = statementService([
      statementRow(1, 500, '2026-09-28T10:00:00.000Z', '150.00', '0', invoiceReg(1)),
      lbpRow,
    ]);

    const statement = await service.getAccountStatement(
      { schoolId: 3 } as never,
      12,
      { accountId: 12, page: 1, limit: 50 },
    );

    expect(statement.summaries).toHaveLength(2);
    expect(statement.summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ shortCode: 'USD', totalDebit: '150.00' }),
        expect.objectContaining({ shortCode: 'LBP', totalDebit: '89500.00' }),
      ]),
    );
    expect(statement.rows.map((row) => row.balance)).toEqual([
      '-150.00',
      '-89500.00',
    ]);
  });

  it('shows manual records automatically from the journal', async () => {
    const { service } = statementService([
      statementRow(6, 600, '2026-10-03T10:00:00.000Z', '500.00', '0', {
        accountingRegisterType: { name: 'Record' },
        records: [{ id: 50, nb: 1 }],
      }),
    ]);

    const statement = await service.getAccountStatement(
      { schoolId: 3 } as never,
      12,
      { accountId: 12, page: 1, limit: 50 },
    );

    expect(statement.rows[0]).toEqual(
      expect.objectContaining({
        documentType: 'Record',
        documentNb: 1,
        documentKind: 'records',
        balance: '-500.00',
      }),
    );
  });
});

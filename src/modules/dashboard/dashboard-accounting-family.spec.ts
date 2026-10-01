import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardAccountingService } from './dashboard-accounting.service';

/**
 * Direct-API bypass tests: the frontend posting lookup only offers eligible
 * accounts, but the backend posting services must reject forged requests
 * (wrong family, structural/group codes, cross-school accounts) on their own.
 */

type PostingAccount = {
  id: number;
  code: string;
  name: string;
  type: string;
  isGroup: boolean;
};

const ENTITY: PostingAccount = {
  id: 12,
  code: '41110001',
  name: 'Ahmad Hassan Khalil',
  type: 'PERSON',
  isGroup: false,
};

const CASH: PostingAccount = {
  id: 31,
  code: '50000001',
  name: 'Cash',
  type: 'CASH',
  isGroup: false,
};

const BANK: PostingAccount = {
  id: 32,
  code: '50000002',
  name: 'Bank Audi',
  type: 'GENERAL',
  isGroup: false,
};

const GROUP4: PostingAccount = {
  id: 53,
  code: '4111',
  name: 'Ordinary customers',
  type: 'GENERAL',
  isGroup: true,
};

const STRUCT5: PostingAccount = {
  id: 54,
  code: '5000',
  name: 'Cash group',
  type: 'GENERAL',
  isGroup: true,
};

const SALES = { id: 55, code: '400001', name: 'Sales', type: 'SALES' };

const USD = {
  id: 1,
  title: 'US Dollar',
  shortCode: 'USD',
  symbol: '$',
  rate: '1',
};
const ITEM = { id: 5, name: 'Tuition', price: '100.00' };

function lockedRow(account: PostingAccount | null, schoolId = 3) {
  return {
    parentId: 7,
    personId: 70,
    accountId: account?.id ?? null,
    firstName: 'Ahmad',
    middleName: 'Hassan',
    lastName: 'Khalil',
    accountCode: account?.code ?? null,
    accountSchoolId: account ? schoolId : null,
    isGroup: account?.isGroup ?? null,
  };
}

type JournalLine = {
  accountId: number;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

function postingTx(
  accounts: Record<number, PostingAccount>,
  rawQueue: unknown[],
  dailyRows: Array<{ accountId: number; debit: string; credit: string }>,
  items: unknown[] = [ITEM],
  personByAccountId: Record<number, unknown> = {},
) {
  const queue = [...rawQueue];
  const posted: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: jest.fn(() => Promise.resolve(queue.shift())),
    account: {
      findFirst: jest.fn((args: { where: { id?: number; type?: string } }) => {
        if (args.where.type) {
          return Promise.resolve(SALES);
        }
        const row =
          args.where.id === undefined
            ? null
            : (accounts[args.where.id] ?? null);
        return Promise.resolve(row);
      }),
      findMany: jest.fn((args: { where: { id: { in: number[] } } }) =>
        Promise.resolve(
          args.where.id.in
            .map((id) => accounts[id])
            .filter((row) => row !== undefined),
        ),
      ),
    },
    currency: { findUnique: jest.fn(() => Promise.resolve(USD)) },
    person: {
      findFirst: jest.fn((args: { where: { accountId?: number } }) =>
        Promise.resolve(
          args.where.accountId === undefined
            ? null
            : (personByAccountId[args.where.accountId] ?? null),
        ),
      ),
    },
    item: { findMany: jest.fn(() => Promise.resolve(items)) },
    registration: { findMany: jest.fn(() => Promise.resolve([])) },
    accountingRegisterType: {
      findUnique: jest.fn(() => Promise.resolve({ id: 9 })),
    },
    accountingRegister: {
      create: jest.fn(() =>
        Promise.resolve({
          id: 100,
          dateCreated: new Date('2026-09-26T10:00:00Z'),
        }),
      ),
    },
    accountingReceipt: {
      create: jest.fn(() => Promise.resolve({ id: 10 })),
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
    accountingReceiptDetail: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
    },
    accountingPayment: {
      create: jest.fn(() => Promise.resolve({ id: 11 })),
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
    accountingPaymentDetail: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
    },
    accountingInvoice: { create: jest.fn(() => Promise.resolve({ id: 20 })) },
    accountingInvoiceDetail: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
    },
    accountingDaily: {
      createMany: jest.fn((args: { data: Array<Record<string, unknown>> }) => {
        posted.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
      findMany: jest.fn(() => Promise.resolve(dailyRows)),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (t: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return {
    tx,
    posted: posted as JournalLine[],
    service: new DashboardAccountingService(prisma as never),
  };
}

const user = { schoolId: 3 } as never;
const ACCOUNTS: Record<number, PostingAccount> = {
  [ENTITY.id]: ENTITY,
  [CASH.id]: CASH,
  [BANK.id]: BANK,
  [GROUP4.id]: GROUP4,
  [STRUCT5.id]: STRUCT5,
};

describe('Receipt backend family enforcement', () => {
  const balanced = [
    { accountId: 31, debit: '150.00', credit: '0' },
    { accountId: 12, debit: '0', credit: '150.00' },
  ];

  it('accepts a valid family-4 To account with NO parent relation', async () => {
    const { service, posted } = postingTx(
      ACCOUNTS,
      [[{ nb: 1 }]],
      balanced,
      [ITEM],
      {},
    );
    const receipt = await service.createReceipt(user, {
      accountId: 12,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 150 }],
    });
    expect(receipt.accountCode).toBe('41110001');
    expect(receipt.parentId).toBeNull();
    expect(receipt.parentName).toBe('Ahmad Hassan Khalil');
    // Journal direction unchanged: destination DEBIT, To account CREDIT.
    expect(posted).toHaveLength(2);
    expect(posted[0]).toMatchObject({ accountId: 31 });
    expect((posted[0].debit as Prisma.Decimal).toFixed(2)).toBe('150.00');
    expect(posted[1]).toMatchObject({ accountId: 12 });
    expect((posted[1].credit as Prisma.Decimal).toFixed(2)).toBe('150.00');
  });

  it('resolves the parent linkage when the To account belongs to a parent', async () => {
    const { service } = postingTx(ACCOUNTS, [[{ nb: 1 }]], balanced, [ITEM], {
      12: {
        firstName: 'Ahmad',
        middleName: 'Hassan',
        lastName: 'Khalil',
        parent: { id: 7 },
      },
    });
    const receipt = await service.createReceipt(user, {
      accountId: 12,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 150 }],
    });
    expect(receipt.parentId).toBe(7);
    expect(receipt.parentName).toBe('Ahmad Hassan Khalil');
  });

  it.each([
    ['family-5 To account', 31],
    ['structural To account', 54],
    ['group To account', 53],
    ['cross-school To account', 99],
  ])('rejects %s', async (_label, accountId) => {
    const { service, tx } = postingTx(ACCOUNTS, [], balanced);
    await expect(
      service.createReceipt(user, {
        accountId,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 150 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it.each([
    ['family-4 destination', ENTITY.id],
    ['structural 5000 destination', STRUCT5.id],
    ['group 4111 destination', GROUP4.id],
    ['cross-school destination', 99],
  ])('rejects %s', async (_label, accountId) => {
    const { service, tx } = postingTx(ACCOUNTS, [], balanced);
    await expect(
      service.createReceipt(user, {
        accountId: 12,
        currencyId: 1,
        allocations: [{ accountId, amount: 150 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });
});

describe('Payment backend family enforcement', () => {
  const balanced = [
    { accountId: 12, debit: '150.00', credit: '0' },
    { accountId: 31, debit: '0', credit: '150.00' },
  ];

  it('accepts a family-4 To account funded by family-5 sources', async () => {
    const { service, posted } = postingTx(ACCOUNTS, [[{ nb: 2 }]], balanced);
    const payment = await service.createPayment(user, {
      accountId: 12,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 150 }],
    });
    expect(payment.accountCode).toBe('41110001');
    // Journal direction unchanged: destination DEBIT, funding CREDIT.
    expect(posted).toHaveLength(2);
    expect(posted[0]).toMatchObject({ accountId: 12 });
    expect((posted[0].debit as Prisma.Decimal).toFixed(2)).toBe('150.00');
    expect(posted[1]).toMatchObject({ accountId: 31 });
    expect((posted[1].credit as Prisma.Decimal).toFixed(2)).toBe('150.00');
  });

  it.each([
    ['family-5 destination', CASH.id],
    ['structural destination', STRUCT5.id],
    ['group destination', GROUP4.id],
    ['cross-school destination', 99],
  ])('rejects %s', async (_label, accountId) => {
    const { service, tx } = postingTx(ACCOUNTS, [], balanced);
    await expect(
      service.createPayment(user, {
        accountId,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 150 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it.each([
    ['family-4 funding source', ENTITY.id],
    ['structural funding source', STRUCT5.id],
    ['group funding source', GROUP4.id],
    ['cross-school funding source', 99],
  ])('rejects %s', async (_label, accountId) => {
    const { service, tx } = postingTx(ACCOUNTS, [], balanced);
    await expect(
      service.createPayment(user, {
        accountId: 12,
        currencyId: 1,
        allocations: [{ accountId, amount: 150 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });
});

describe('Invoice backend family enforcement', () => {
  const balanced = [
    { accountId: 12, debit: '100.00', credit: '0' },
    { accountId: 55, debit: '0', credit: '100.00' },
  ];
  const details = [{ itemId: 5, quantity: 1 }];

  it('accepts a valid family-4 entity with parent debit and sales credit', async () => {
    const { service, posted } = postingTx(
      ACCOUNTS,
      [[lockedRow(ENTITY)], [{ nb: 3 }]],
      balanced,
    );
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 20 } as never);
    const invoice = await service.createInvoice(user, {
      parentId: 7,
      currencyId: 1,
      details,
    });
    expect(invoice).toMatchObject({ id: 20 });
    expect(posted).toHaveLength(2);
    expect(posted[0]).toMatchObject({ accountId: 12 });
    expect((posted[0].debit as Prisma.Decimal).toFixed(2)).toBe('100.00');
    expect(posted[1]).toMatchObject({ accountId: 55 });
    expect((posted[1].credit as Prisma.Decimal).toFixed(2)).toBe('100.00');
  });

  it.each([
    ['family-5 entity', CASH],
    ['structural 4111 entity', { ...GROUP4, id: 12 }],
    ['group entity', { ...ENTITY, id: 12, isGroup: true }],
  ])('rejects %s', async (_label, account) => {
    const { service } = postingTx(
      ACCOUNTS,
      [[lockedRow(account as PostingAccount)]],
      balanced,
    );
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 20 } as never);
    await expect(
      service.createInvoice(user, { parentId: 7, currencyId: 1, details }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a cross-school entity account', async () => {
    const { service } = postingTx(ACCOUNTS, [[lockedRow(ENTITY, 9)]], balanced);
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 20 } as never);
    await expect(
      service.createInvoice(user, { parentId: 7, currencyId: 1, details }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

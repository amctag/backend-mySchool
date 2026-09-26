import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardAccountingService } from './dashboard-accounting.service';

const lockedParent = {
  parentId: 7,
  personId: 70,
  accountId: 12,
  firstName: 'Ahmad',
  middleName: 'Hassan',
  lastName: 'Khalil',
  accountCode: '100001',
  accountSchoolId: 3,
};

const usdCurrency = {
  id: 1,
  title: 'US Dollar',
  shortCode: 'USD',
  symbol: '$',
  rate: '1',
};

const cashAccount = { id: 31, code: '200001', name: 'Cash', type: 'CASH' };
const bankAccount = {
  id: 32,
  code: '100005',
  name: 'Bank Audi',
  type: 'GENERAL',
};

function mocks(overrides?: {
  queryRawResults?: unknown[];
  accountFindFirst?: unknown;
  accountFindMany?: unknown[];
  accountCount?: number;
  accountCreate?: unknown;
  accountUpdate?: unknown;
  currencyFindUnique?: unknown;
  currencies?: unknown[];
  registerCreate?: { id: number };
  registerFindFirst?: unknown;
  receiptCreate?: unknown;
  dailyRows?: Array<{ accountId: number; debit: unknown; credit: unknown }>;
  persons?: unknown[];
}) {
  const queue = [...(overrides?.queryRawResults ?? [])];
  const findFirstQueue = Array.isArray(overrides?.accountFindFirst)
    ? [...(overrides?.accountFindFirst as unknown[])]
    : null;
  const tx: Record<string, Record<string, jest.Mock>> = {
    $queryRaw: undefined as never,
    account: {
      findFirst: jest.fn(() => {
        if (findFirstQueue) {
          return Promise.resolve(findFirstQueue.shift() ?? null);
        }
        return Promise.resolve(overrides?.accountFindFirst ?? null);
      }),
      findMany: jest.fn(() =>
        Promise.resolve(overrides?.accountFindMany ?? []),
      ),
      count: jest.fn(() => Promise.resolve(overrides?.accountCount ?? 0)),
      create: jest.fn(() =>
        Promise.resolve(overrides?.accountCreate ?? { id: 99 }),
      ),
      update: jest.fn(() => Promise.resolve(overrides?.accountUpdate ?? null)),
    },
    currency: {
      findUnique: jest.fn(() =>
        Promise.resolve(overrides?.currencyFindUnique ?? null),
      ),
      findMany: jest.fn(() => Promise.resolve(overrides?.currencies ?? [])),
    },
    accountingRegisterType: {
      findUnique: jest.fn(() => Promise.resolve({ id: 9 })),
    },
    accountingRegister: {
      create: jest.fn(() =>
        Promise.resolve(
          overrides?.registerCreate ?? {
            id: 100,
            dateCreated: new Date('2026-09-26T10:00:00.000Z'),
          },
        ),
      ),
      findFirst: jest.fn(() =>
        Promise.resolve(overrides?.registerFindFirst ?? null),
      ),
    },
    accountingReceipt: {
      create: jest.fn(() =>
        Promise.resolve(overrides?.receiptCreate ?? { id: 10 }),
      ),
      count: jest.fn(() => Promise.resolve(0)),
      findMany: jest.fn(() => Promise.resolve([])),
      findFirst: jest.fn(() => Promise.resolve(null)),
    },
    accountingReceiptDetail: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
    },
    accountingDaily: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      findMany: jest.fn(() => Promise.resolve(overrides?.dailyRows ?? [])),
    },
    person: {
      findMany: jest.fn(() => Promise.resolve(overrides?.persons ?? [])),
    },
  };
  tx.$queryRaw = jest.fn(() => {
    const next = queue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return Promise.resolve(next);
  }) as never;
  const prisma = {
    ...tx,
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg)
        ? Promise.all(arg)
        : (arg as (t: typeof tx) => Promise<unknown>)(tx),
    ),
  };
  return {
    tx,
    prisma,
    service: new DashboardAccountingService(prisma as never),
  };
}

describe('DashboardAccountingService currencies', () => {
  it('lists database-backed USD and LBP with string rates', async () => {
    const { service, tx } = mocks({
      currencies: [
        { id: 1, title: 'US Dollar', shortCode: 'USD', symbol: '$', rate: '1' },
        {
          id: 2,
          title: 'Lebanese Pound',
          shortCode: 'LBP',
          symbol: 'L.L',
          rate: '1',
        },
      ],
    });

    const currencies = await service.listCurrencies();

    expect(currencies).toEqual([
      { id: 1, title: 'US Dollar', shortCode: 'USD', symbol: '$', rate: '1' },
      {
        id: 2,
        title: 'Lebanese Pound',
        shortCode: 'LBP',
        symbol: 'L.L',
        rate: '1',
      },
    ]);
    expect(tx.currency.findMany).toHaveBeenCalled();
  });
});

describe('DashboardAccountingService manual accounts', () => {
  it('creates a GENERAL account without a Person using the global sequence', async () => {
    const { service, tx } = mocks({
      queryRawResults: [[{ code: '100005' }]],
      accountCreate: bankAccount,
    });

    const account = await service.createAccount({ schoolId: 3 } as never, {
      name: 'Bank Audi',
      type: 'GENERAL',
    });

    expect(account).toMatchObject({
      code: '100005',
      name: 'Bank Audi',
      type: 'GENERAL',
      protected: false,
      relatedPerson: null,
    });
    expect(tx.account.create).toHaveBeenCalledWith({
      data: { code: '100005', name: 'Bank Audi', type: 'GENERAL', schoolId: 3 },
      select: { id: true, code: true, name: true, type: true },
    });
  });

  it.each([['PERSON'], ['CASH'], ['SALES'], ['PURCHASES']])(
    'refuses manual creation of %s accounts',
    async (type) => {
      const { service, tx } = mocks();
      await expect(
        service.createAccount({ schoolId: 3 } as never, {
          name: 'Blocked',
          type,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.account.create).not.toHaveBeenCalled();
    },
  );

  it('rejects reading another school account', async () => {
    const { service } = mocks({ accountFindFirst: null });
    await expect(
      service.getAccount({ schoolId: 3 } as never, 99),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects renaming another school account', async () => {
    const { service, tx } = mocks({ accountFindFirst: null });
    await expect(
      service.updateAccount({ schoolId: 3 } as never, 99, { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.account.update).not.toHaveBeenCalled();
  });

  it('renames a GENERAL account without touching its code', async () => {
    const { service, tx } = mocks({
      accountFindFirst: bankAccount,
      accountUpdate: { ...bankAccount, name: 'Bank Audi Main' },
    });

    const account = await service.updateAccount({ schoolId: 3 } as never, 32, {
      name: 'Bank Audi Main',
    });

    expect(account).toMatchObject({ code: '100005', name: 'Bank Audi Main' });
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 32 },
      data: { name: 'Bank Audi Main' },
      select: { id: true, code: true, name: true, type: true },
    });
  });

  it.each([['PERSON'], ['CASH'], ['SALES'], ['PURCHASES']])(
    'refuses renaming %s accounts',
    async (type) => {
      const { service, tx } = mocks({
        accountFindFirst: { id: 1, code: '1', name: 'Sys', type },
      });
      await expect(
        service.updateAccount({ schoolId: 3 } as never, 1, { name: 'Hack' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.account.update).not.toHaveBeenCalled();
    },
  );

  it('lists accounts with search, type filter, pagination and related persons', async () => {
    const accounts = [
      { id: 12, code: '100001', name: 'Ahmad Hassan Khalil', type: 'PERSON' },
      { id: 32, code: '100005', name: 'Bank Audi', type: 'GENERAL' },
    ];
    const { service, tx } = mocks({
      accountFindMany: accounts,
      accountCount: 2,
      persons: [
        {
          accountId: 12,
          firstName: 'Ahmad',
          middleName: 'Hassan',
          lastName: 'Khalil',
          parent: { id: 7 },
        },
      ],
    });
    type AccountWhere = { schoolId: number; type?: string; OR?: unknown[] };
    let seenWhere: AccountWhere | null = null;
    tx.account.findMany.mockImplementation((args: { where: AccountWhere }) => {
      seenWhere = args.where;
      return Promise.resolve(accounts);
    });

    const result = await service.listAccounts({ schoolId: 3 } as never, {
      page: 1,
      limit: 10,
      search: 'audi',
      type: 'GENERAL',
    });

    expect(tx.account.count).toHaveBeenCalled();
    expect(tx.account.findMany).toHaveBeenCalled();
    expect(seenWhere).toMatchObject({ schoolId: 3, type: 'GENERAL' });
    expect(seenWhere?.OR).toHaveLength(2);
    expect(result).toMatchObject({
      page: 1,
      limit: 10,
      total: 2,
      totalPages: 1,
    });
    expect(result.items[0]).toMatchObject({
      code: '100001',
      protected: true,
      relatedPerson: { parentId: 7, fullName: 'Ahmad Hassan Khalil' },
    });
    expect(result.items[1]).toMatchObject({
      code: '100005',
      protected: false,
      relatedPerson: null,
    });
  });

  it('rejects an unknown account type filter', async () => {
    const { service } = mocks();
    await expect(
      service.listAccounts({ schoolId: 3 } as never, { type: 'NOPE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DashboardAccountingService multi-allocation receipts', () => {
  const twoWayInput = {
    parentId: 7,
    currencyId: 1,
    allocations: [
      { accountId: 31, amount: 500, description: 'Cash payment' },
      { accountId: 32, amount: 500, description: 'Bank deposit' },
    ],
  };

  function twoWayMocks(
    dailyRows?: Array<{ accountId: number; debit: unknown; credit: unknown }>,
  ) {
    return mocks({
      queryRawResults: [[lockedParent], [{ nb: 1 }]],
      accountFindFirst: [cashAccount, bankAccount],
      currencyFindUnique: usdCurrency,
      dailyRows: dailyRows ?? [
        { accountId: 31, debit: '500.00', credit: '0' },
        { accountId: 32, debit: '500.00', credit: '0' },
        { accountId: 12, debit: '0', credit: '1000.00' },
      ],
    });
  }

  it('posts Cash 500 + Bank 500 debits with a single 1000 parent credit', async () => {
    const { service, tx } = twoWayMocks();
    type PostedLine = {
      accountId: number;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
    };
    let posted: PostedLine[] = [];
    tx.accountingDaily.createMany.mockImplementation(
      (args: { data: PostedLine[] }) => {
        posted = args.data;
        return Promise.resolve({ count: args.data.length });
      },
    );

    const receipt = await service.createReceipt(
      { schoolId: 3 } as never,
      twoWayInput,
    );

    expect(receipt).toMatchObject({
      nb: 1,
      parentId: 7,
      total: '1000.00',
      amount: '1000.00',
      currency: { id: 1, shortCode: 'USD', symbol: '$', rate: '1' },
      currencyId: 1,
      currencyRate: '1',
    });
    expect(receipt.allocations).toHaveLength(2);
    expect(tx.accountingReceiptDetail.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountingReceiptId: 10,
          accountId: 31,
          amount: new Prisma.Decimal('500.00'),
          description: 'Cash payment',
        },
        {
          accountingReceiptId: 10,
          accountId: 32,
          amount: new Prisma.Decimal('500.00'),
          description: 'Bank deposit',
        },
      ],
    });
    expect(posted).toHaveLength(3);
    expect(posted.map((line) => line.accountId)).toEqual([31, 32, 12]);
    expect(posted[0].debit.equals(new Prisma.Decimal('500.00'))).toBe(true);
    expect(posted[1].debit.equals(new Prisma.Decimal('500.00'))).toBe(true);
    expect(posted[2].credit.equals(new Prisma.Decimal('1000.00'))).toBe(true);
    expect(tx.accountingRegister.create).toHaveBeenCalledWith({
      data: {
        description: null,
        accountingRegisterTypeId: 9,
        currencyId: 1,
        notes: null,
        comments: null,
        currencyRate: new Prisma.Decimal('1'),
        schoolId: 3,
        idempotencyKey: null,
      },
      select: { id: true, dateCreated: true },
    });
  });

  it('rejects an unbalanced journal', async () => {
    const { service } = twoWayMocks([
      { accountId: 31, debit: '500.00', credit: '0' },
      { accountId: 12, debit: '0', credit: '400.00' },
    ]);
    await expect(
      service.createReceipt({ schoolId: 3 } as never, twoWayInput),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('rejects empty allocations', async () => {
    const { service, tx } = mocks({
      queryRawResults: [[lockedParent]],
      currencyFindUnique: usdCurrency,
    });
    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it.each([[0], [-25]])('rejects %s allocation amounts', async (amount) => {
    const { service, tx } = mocks({
      queryRawResults: [[lockedParent]],
      currencyFindUnique: usdCurrency,
      accountFindFirst: [cashAccount],
    });
    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [{ accountId: 31, amount }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects a PERSON destination', async () => {
    const { service, tx } = mocks({
      queryRawResults: [[lockedParent]],
      currencyFindUnique: usdCurrency,
      accountFindFirst: [
        { id: 50, code: '100009', name: 'Someone', type: 'PERSON' },
      ],
    });
    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [{ accountId: 50, amount: 100 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it.each([['SALES'], ['PURCHASES']])(
    'rejects a %s destination',
    async (type) => {
      const { service, tx } = mocks({
        queryRawResults: [[lockedParent]],
        currencyFindUnique: usdCurrency,
        accountFindFirst: [{ id: 60, code: '600001', name: type, type }],
      });
      await expect(
        service.createReceipt({ schoolId: 3 } as never, {
          parentId: 7,
          currencyId: 1,
          allocations: [{ accountId: 60, amount: 100 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.accountingRegister.create).not.toHaveBeenCalled();
    },
  );

  it('rejects a cross-school destination', async () => {
    const { service, tx } = mocks({
      queryRawResults: [[lockedParent]],
      currencyFindUnique: usdCurrency,
      accountFindFirst: [],
    });
    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [{ accountId: 77, amount: 100 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate destination accounts', async () => {
    const { service, tx } = mocks({
      queryRawResults: [[lockedParent]],
      currencyFindUnique: usdCurrency,
      accountFindFirst: [cashAccount, cashAccount],
    });
    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [
          { accountId: 31, amount: 100 },
          { accountId: 31, amount: 200 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid currency', async () => {
    const { service, tx } = mocks({
      queryRawResults: [[lockedParent]],
      currencyFindUnique: null,
    });
    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 4242,
        allocations: [{ accountId: 31, amount: 100 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('returns the same receipt for a duplicate idempotency key without new rows', async () => {
    const register = {
      id: 100,
      description: null,
      currencyId: 1,
      currencyRate: '1',
      currency: usdCurrency,
      notes: null,
      comments: null,
      dateCreated: new Date('2026-09-26T10:00:00.000Z'),
      receipts: [
        {
          id: 10,
          nb: 4,
          schoolId: 3,
          details: [
            {
              accountId: 31,
              amount: '500.00',
              description: 'Cash payment',
              account: { id: 31, code: '200001', name: 'Cash' },
            },
            {
              accountId: 32,
              amount: '500.00',
              description: 'Bank deposit',
              account: { id: 32, code: '100005', name: 'Bank Audi' },
            },
          ],
        },
      ],
      dailyEntries: [
        {
          accountId: 31,
          debit: '500.00',
          credit: '0',
          account: { id: 31, code: '200001' },
        },
        {
          accountId: 32,
          debit: '500.00',
          credit: '0',
          account: { id: 32, code: '100005' },
        },
        {
          accountId: 12,
          debit: '0',
          credit: '1000.00',
          account: { id: 12, code: '100001' },
        },
      ],
    };
    const { service, tx } = mocks({
      registerFindFirst: register,
      persons: [
        {
          accountId: 12,
          firstName: 'Ahmad',
          middleName: 'Hassan',
          lastName: 'Khalil',
          parent: { id: 7 },
        },
      ],
    });

    const receipt = await service.createReceipt({ schoolId: 3 } as never, {
      ...twoWayInput,
      idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(receipt).toMatchObject({ nb: 4, total: '1000.00' });
    expect(receipt.allocations).toHaveLength(2);
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
    expect(tx.accountingReceipt.create).not.toHaveBeenCalled();
    expect(tx.accountingReceiptDetail.createMany).not.toHaveBeenCalled();
    expect(tx.accountingDaily.createMany).not.toHaveBeenCalled();
  });

  it('renders legacy Phase 2B receipts without detail rows from debit lines', async () => {
    const register = {
      id: 100,
      description: 'Tuition',
      currencyId: null,
      currencyRate: null,
      currency: null,
      notes: null,
      comments: null,
      dateCreated: new Date('2026-09-26T10:00:00.000Z'),
      receipts: [{ id: 10, nb: 4, schoolId: 3, details: [] }],
      dailyEntries: [
        {
          accountId: 31,
          debit: '150.00',
          credit: '0',
          account: { id: 31, code: '200001', name: 'Cash' },
        },
        {
          accountId: 12,
          debit: '0',
          credit: '150.00',
          account: { id: 12, code: '100001' },
        },
      ],
    };
    const { service } = mocks({
      registerFindFirst: register,
      persons: [
        {
          accountId: 12,
          firstName: 'Ahmad',
          middleName: 'Hassan',
          lastName: 'Khalil',
          parent: { id: 7 },
        },
      ],
    });

    const receipt = await service.createReceipt({ schoolId: 3 } as never, {
      ...twoWayInput,
      idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(receipt).toMatchObject({ nb: 4, total: '150.00', currency: null });
    expect(receipt.allocations).toEqual([
      {
        accountId: 31,
        accountCode: '200001',
        accountName: 'Cash',
        amount: '150.00',
        description: null,
      },
    ]);
  });
});

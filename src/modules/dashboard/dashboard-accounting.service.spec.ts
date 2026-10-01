import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardAccountingService } from './dashboard-accounting.service';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

type PostedJournalLine = {
  accountId: number;
  debit: Prisma.Decimal | number | string;
  credit: Prisma.Decimal | number | string;
  description?: string | null;
  accountingRegisterId?: number;
};

function baseTransaction(overrides?: {
  queryRawResults?: unknown[];
  accountFindFirst?: unknown;
  accountFindMany?: unknown[];
  accountCreate?: unknown;
  registerType?: { id: number } | null;
  registerCreate?: { id: number };
  registerFindFirst?: unknown;
  receiptCreate?: unknown;
  currency?: unknown;
  paymentCreate?: unknown;
  dailyRows?: Array<{ accountId: number; debit: unknown; credit: unknown }>;
  persons?: unknown[];
}) {
  const queue = [...(overrides?.queryRawResults ?? [])];
  const $queryRaw = jest.fn(() => {
    const next = queue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return Promise.resolve(next);
  });
  return {
    $queryRaw,
    account: {
      findFirst: jest.fn(() =>
        Promise.resolve(overrides?.accountFindFirst ?? null),
      ),
      create: jest.fn(() =>
        Promise.resolve(overrides?.accountCreate ?? { id: 1 }),
      ),
      findMany: jest.fn(() =>
        Promise.resolve(overrides?.accountFindMany ?? []),
      ),
    },
    accountingRegisterType: {
      findUnique: jest.fn(() =>
        Promise.resolve(overrides?.registerType ?? { id: 9 }),
      ),
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
      update: jest.fn(),
    },
    accountingReceipt: {
      create: jest.fn(() =>
        Promise.resolve(overrides?.receiptCreate ?? { id: 10 }),
      ),
      findFirst: jest.fn(),
    },
    accountingReceiptDetail: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      deleteMany: jest.fn(),
    },
    currency: {
      findUnique: jest.fn(() => Promise.resolve(overrides?.currency ?? null)),
    },
    accountingPayment: {
      create: jest.fn(() =>
        Promise.resolve(overrides?.paymentCreate ?? { id: 11 }),
      ),
      findFirst: jest.fn(),
    },
    accountingPaymentDetail: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      deleteMany: jest.fn(),
    },
    accountingDaily: {
      createMany: jest.fn((args: { data: PostedJournalLine[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      findMany: jest.fn(() => Promise.resolve(overrides?.dailyRows ?? [])),
      deleteMany: jest.fn(),
    },
    person: {
      findMany: jest.fn(() => Promise.resolve(overrides?.persons ?? [])),
    },
  };
}

function serviceWith(transaction: ReturnType<typeof baseTransaction>) {
  const prisma = {
    $transaction: jest.fn(
      (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    account: transaction.account,
    accountingReceipt: {
      count: jest.fn(() => Promise.resolve(0)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
    accountingPayment: {
      count: jest.fn(() => Promise.resolve(0)),
      findMany: jest.fn(() => Promise.resolve([])),
    },
  };
  return new DashboardAccountingService(prisma as never);
}

const lockedParent = {
  parentId: 7,
  personId: 70,
  accountId: 12,
  firstName: 'Ahmad',
  middleName: 'Hassan',
  lastName: 'Khalil',
  accountCode: '41110001',
  accountSchoolId: 3,
  isGroup: false,
};

const balancedReceiptRows = [
  { accountId: 31, debit: '150.00', credit: '0' },
  { accountId: 12, debit: '0', credit: '150.00' },
];

const cashAccount = {
  id: 31,
  code: '50000001',
  name: 'Cash',
  type: 'CASH',
  parentId: null,
  isGroup: false,
};

const usdCurrency = {
  id: 1,
  title: 'US Dollar',
  shortCode: 'USD',
  symbol: '$',
  rate: '1',
};

const accountSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  parentId: true,
  isGroup: true,
};

describe('DashboardAccountingService document edits', () => {
  it('rebuilds a receipt journal on the same register and preserves its document identity', async () => {
    const transaction = baseTransaction({
      queryRawResults: [[lockedParent]],
      accountFindFirst: cashAccount,
      currency: usdCurrency,
      dailyRows: balancedReceiptRows,
    });
    transaction.accountingReceipt.findFirst.mockResolvedValue({
      id: 10,
      accountingRegisterId: 100,
    });
    const service = serviceWith(transaction);
    jest.spyOn(service, 'getReceipt').mockResolvedValue({
      id: 10,
      nb: 42,
    } as never);

    const edited = await service.updateReceipt({ schoolId: 3 } as never, 10, {
      parentId: 7,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 150 }],
    });

    expect(edited).toEqual(expect.objectContaining({ id: 10, nb: 42 }));
    expect(transaction.accountingRegister.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 100 } }),
    );
    expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
    expect(transaction.accountingReceipt.create).not.toHaveBeenCalled();
    expect(transaction.accountingDaily.deleteMany).toHaveBeenCalledWith({
      where: { accountingRegisterId: 100 },
    });
    expect(transaction.accountingDaily.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          accountId: 31,
          debit: new Prisma.Decimal(150),
        }),
        expect.objectContaining({
          accountId: 12,
          credit: new Prisma.Decimal(150),
        }),
      ]),
    });
  });

  it('rebuilds a balanced payment journal on the same register', async () => {
    const transaction = baseTransaction({
      accountFindFirst: {
        id: 12,
        code: '41110001',
        name: 'Parent',
        type: 'PERSON',
        isGroup: false,
      },
      accountFindMany: [cashAccount],
      currency: usdCurrency,
      dailyRows: [
        { accountId: 12, debit: '150.00', credit: '0' },
        { accountId: 31, debit: '0', credit: '150.00' },
      ],
    });
    transaction.accountingPayment.findFirst.mockResolvedValue({
      id: 11,
      accountingRegisterId: 101,
    });
    const service = serviceWith(transaction);
    jest
      .spyOn(service, 'getPayment')
      .mockResolvedValue({ id: 11, nb: 9 } as never);

    const edited = await service.updatePayment({ schoolId: 3 } as never, 11, {
      accountId: 12,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 150 }],
    });

    expect(edited).toEqual(expect.objectContaining({ id: 11, nb: 9 }));
    expect(transaction.accountingRegister.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 101 } }),
    );
    expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
    expect(transaction.accountingPayment.create).not.toHaveBeenCalled();
  });

  it('rejects editing a receipt outside the authenticated school', async () => {
    const transaction = baseTransaction();
    transaction.accountingReceipt.findFirst.mockResolvedValue(null);
    const service = serviceWith(transaction);

    await expect(
      service.updateReceipt({ schoolId: 3 } as never, 99, {
        parentId: 7,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 150 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.accountingRegister.update).not.toHaveBeenCalled();
  });

  it('rejects editing a payment outside the authenticated school', async () => {
    const transaction = baseTransaction();
    transaction.accountingPayment.findFirst.mockResolvedValue(null);
    const service = serviceWith(transaction);

    await expect(
      service.updatePayment({ schoolId: 3 } as never, 99, {
        accountId: 7,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 150 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.accountingRegister.update).not.toHaveBeenCalled();
  });
});

describe('DashboardAccountingService system accounts', () => {
  it('creates Cash, Sales and Purchases once per school', async () => {
    const transaction = baseTransaction({
      queryRawResults: [
        [{ code: '50000001' }],
        [{ code: '50000002' }],
        [{ code: '200003' }],
      ],
      accountCreate: cashAccount,
    });
    const service = serviceWith(transaction);

    const accounts = await service.ensureSystemAccounts({
      schoolId: 3,
    } as never);

    expect(accounts).toHaveLength(3);
    expect(transaction.account.create).toHaveBeenCalledTimes(3);
    expect(transaction.account.create).toHaveBeenNthCalledWith(1, {
      data: { code: '50000001', name: 'Cash', type: 'CASH', schoolId: 3 },
      select: accountSelect,
    });
    expect(transaction.account.create).toHaveBeenNthCalledWith(2, {
      data: { code: '50000002', name: 'Sales', type: 'SALES', schoolId: 3 },
      select: accountSelect,
    });
    expect(transaction.account.create).toHaveBeenNthCalledWith(3, {
      data: {
        code: '200003',
        name: 'Purchases',
        type: 'PURCHASES',
        schoolId: 3,
      },
      select: accountSelect,
    });
    expect(transaction.account.findFirst).toHaveBeenNthCalledWith(1, {
      where: { schoolId: 3, type: 'CASH' },
      select: accountSelect,
    });
    expect(transaction.account.findFirst).toHaveBeenNthCalledWith(2, {
      where: { schoolId: 3, type: 'SALES' },
      select: accountSelect,
    });
    expect(transaction.account.findFirst).toHaveBeenNthCalledWith(3, {
      where: { schoolId: 3, type: 'PURCHASES' },
      select: accountSelect,
    });
  });

  it('is idempotent: existing system accounts are returned untouched', async () => {
    const transaction = baseTransaction({
      accountFindFirst: cashAccount,
    });
    const service = serviceWith(transaction);

    const accounts = await service.ensureSystemAccounts({
      schoolId: 3,
    } as never);

    expect(accounts).toHaveLength(3);
    expect(transaction.account.create).not.toHaveBeenCalled();
    expect(transaction.$queryRaw).not.toHaveBeenCalled();
  });

  it('survives a concurrent setup race via the system-type unique index', async () => {
    const transaction = baseTransaction({
      queryRawResults: [
        [{ code: '50000001' }],
        [{ code: '50000002' }],
        [{ code: '200003' }],
      ],
    });
    transaction.account.create.mockRejectedValueOnce(uniqueViolation());
    transaction.account.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(cashAccount);
    const service = serviceWith(transaction);

    const accounts = await service.ensureSystemAccounts({
      schoolId: 3,
    } as never);

    expect(accounts[0]).toEqual({
      id: 31,
      code: '50000001',
      name: 'Cash',
      type: 'CASH',
      protected: true,
      parentId: null,
      isGroup: false,
      hasChildren: false,
      relatedPerson: null,
    });
  });
});

describe('DashboardAccountingService receipts', () => {
  it('posts a balanced receipt with Cash debit and Parent credit', async () => {
    const transaction = baseTransaction({
      queryRawResults: [[lockedParent], [{ nb: 1 }]],
      accountFindFirst: cashAccount,
      currency: usdCurrency,
      dailyRows: balancedReceiptRows,
    });
    const service = serviceWith(transaction);

    const receipt = await service.createReceipt({ schoolId: 3 } as never, {
      parentId: 7,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 150 }],
    });

    expect(receipt).toMatchObject({
      nb: 1,
      parentId: 7,
      parentName: 'Ahmad Hassan Khalil',
      accountId: 12,
      accountCode: '41110001',
      amount: '150.00',
      total: '150.00',
      allocations: [
        {
          accountId: 31,
          accountCode: '50000001',
          accountName: 'Cash',
          amount: '150.00',
          description: null,
        },
      ],
      currency: { id: 1, shortCode: 'USD', symbol: '$' },
    });
    expect(transaction.accountingRegister.create).toHaveBeenCalledWith({
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
    expect(transaction.accountingReceipt.create).toHaveBeenCalledWith({
      data: { accountingRegisterId: 100, nb: 1, schoolId: 3 },
      select: { id: true },
    });
    expect(transaction.accountingReceiptDetail.createMany).toHaveBeenCalledWith(
      {
        data: [
          {
            accountingReceiptId: 10,
            accountId: 31,
            amount: new Prisma.Decimal('150.00'),
            description: null,
          },
        ],
      },
    );
    expect(transaction.accountingDaily.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountId: 31,
          debit: new Prisma.Decimal('150.00'),
          credit: new Prisma.Decimal('0'),
          description: null,
          accountingRegisterId: 100,
        },
        {
          accountId: 12,
          debit: new Prisma.Decimal('0'),
          credit: new Prisma.Decimal('150.00'),
          description: null,
          accountingRegisterId: 100,
        },
      ],
    });
  });

  it('rejects a parent without an accounting account', async () => {
    const transaction = baseTransaction({
      queryRawResults: [
        [
          {
            ...lockedParent,
            accountId: null,
            accountCode: null,
            accountSchoolId: null,
          },
        ],
      ],
    });
    const service = serviceWith(transaction);

    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 50 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects a parent whose account belongs to another school', async () => {
    const transaction = baseTransaction({
      queryRawResults: [[{ ...lockedParent, accountSchoolId: 9 }]],
    });
    const service = serviceWith(transaction);

    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 50 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects a parent outside the authenticated school', async () => {
    const transaction = baseTransaction({ queryRawResults: [[]] });
    const service = serviceWith(transaction);

    await expect(
      service.createReceipt({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 50 }],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the original receipt for a duplicate idempotency key', async () => {
    const register = {
      id: 100,
      description: 'Tuition',
      currencyId: 1,
      currencyRate: '1',
      currency: usdCurrency,
      notes: null,
      comments: null,
      dateCreated: new Date('2026-09-26T10:00:00.000Z'),
      receipts: [{ id: 10, nb: 4, schoolId: 3, details: [] }],
      dailyEntries: [
        {
          accountId: 31,
          debit: '150.00',
          credit: '0',
          account: { id: 31, code: '50000001' },
        },
        {
          accountId: 12,
          debit: '0',
          credit: '150.00',
          account: { id: 12, code: '41110001' },
        },
      ],
    };
    const transaction = baseTransaction({
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
    const service = serviceWith(transaction);

    const receipt = await service.createReceipt({ schoolId: 3 } as never, {
      parentId: 7,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 150 }],
      idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(receipt).toMatchObject({ nb: 4, parentId: 7, amount: '150.00' });
    expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
    expect(transaction.accountingReceipt.create).not.toHaveBeenCalled();
  });
});

describe('DashboardAccountingService payments', () => {
  const destination = {
    id: 40,
    code: '41110002',
    name: 'Supplies',
    type: 'PERSON',
    isGroup: false,
  };

  it('posts one balanced payment with two funding allocations', async () => {
    const bankAccount = {
      id: 32,
      code: '50000002',
      name: 'Bank Audi',
      type: 'GENERAL',
      isGroup: false,
    };
    const transaction = baseTransaction({
      queryRawResults: [[{ nb: 2 }]],
      currency: usdCurrency,
      accountFindMany: [cashAccount, bankAccount],
      dailyRows: [
        { accountId: 40, debit: '1000', credit: '0' },
        { accountId: 31, debit: '0', credit: '300' },
        { accountId: 32, debit: '0', credit: '700' },
      ],
    });
    transaction.account.findFirst.mockResolvedValueOnce(destination);
    const service = serviceWith(transaction);

    const payment = await service.createPayment({ schoolId: 3 } as never, {
      accountId: 40,
      currencyId: 1,
      allocations: [
        { accountId: 31, amount: 300 },
        { accountId: 32, amount: 700, description: 'Bank transfer' },
      ],
    });

    expect(payment).toMatchObject({
      nb: 2,
      accountId: 40,
      accountCode: '41110002',
      amount: '1000.00',
      total: '1000.00',
      allocations: [
        { accountId: 31, amount: '300.00' },
        { accountId: 32, amount: '700.00' },
      ],
    });
    expect(transaction.accountingPayment.create).toHaveBeenCalledWith({
      data: { accountingRegisterId: 100, nb: 2, schoolId: 3 },
      select: { id: true },
    });
    expect(transaction.accountingDaily.createMany).toHaveBeenCalledWith({
      data: [
        {
          accountId: 40,
          debit: new Prisma.Decimal('1000'),
          credit: new Prisma.Decimal('0'),
          description: null,
          accountingRegisterId: 100,
        },
        {
          accountId: 31,
          debit: new Prisma.Decimal('0'),
          credit: new Prisma.Decimal('300'),
          description: null,
          accountingRegisterId: 100,
        },
        {
          accountId: 32,
          debit: new Prisma.Decimal('0'),
          credit: new Prisma.Decimal('700'),
          description: 'Bank transfer',
          accountingRegisterId: 100,
        },
      ],
    });
    expect(transaction.accountingPaymentDetail.createMany).toHaveBeenCalledWith(
      {
        data: [
          {
            accountingPaymentId: 11,
            accountId: 31,
            amount: new Prisma.Decimal('300'),
            description: null,
          },
          {
            accountingPaymentId: 11,
            accountId: 32,
            amount: new Prisma.Decimal('700'),
            description: 'Bank transfer',
          },
        ],
      },
    );
  });

  it('rejects a destination account from another school', async () => {
    const transaction = baseTransaction({});
    transaction.account.findFirst.mockResolvedValue(null);
    const service = serviceWith(transaction);

    await expect(
      service.createPayment({ schoolId: 3 } as never, {
        accountId: 40,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 10 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects a funding account that is also the destination', async () => {
    const transaction = baseTransaction({
      accountFindFirst: cashAccount,
      currency: usdCurrency,
    });
    transaction.account.findFirst.mockResolvedValue(cashAccount);
    const service = serviceWith(transaction);

    await expect(
      service.createPayment({ schoolId: 3 } as never, {
        accountId: 31,
        currencyId: 1,
        allocations: [{ accountId: 31, amount: 10 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
  });

  it('rejects PERSON and cross-school funding accounts', async () => {
    for (const accounts of [
      [
        {
          id: 41,
          code: '41110003',
          name: 'Person',
          type: 'PERSON',
          isGroup: false,
        },
      ],
      [],
    ]) {
      const transaction = baseTransaction({
        currency: usdCurrency,
        accountFindMany: accounts,
      });
      transaction.account.findFirst.mockResolvedValue(destination);
      const service = serviceWith(transaction);

      await expect(
        service.createPayment({ schoolId: 3 } as never, {
          accountId: 40,
          currencyId: 1,
          allocations: [{ accountId: 41, amount: 10 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(transaction.accountingRegister.create).not.toHaveBeenCalled();
    }
  });

  it('returns the original payment for a duplicate idempotency key', async () => {
    const register = {
      id: 101,
      description: 'Supplies',
      currencyId: null,
      currencyRate: null,
      notes: null,
      comments: null,
      dateCreated: new Date('2026-09-26T10:00:00.000Z'),
      payments: [{ id: 11, nb: 6, schoolId: 3 }],
      dailyEntries: [
        {
          accountId: 40,
          debit: '75.50',
          credit: '0',
          account: { id: 40, code: '41110002', name: 'Supplies' },
        },
        {
          accountId: 31,
          debit: '0',
          credit: '75.50',
          account: { id: 31, code: '50000001', name: 'Cash' },
        },
      ],
    };
    const transaction = baseTransaction({ registerFindFirst: register });
    const service = serviceWith(transaction);

    const payment = await service.createPayment({ schoolId: 3 } as never, {
      accountId: 40,
      currencyId: 1,
      allocations: [{ accountId: 31, amount: 75.5 }],
      idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    expect(payment).toMatchObject({
      nb: 6,
      accountCode: '41110002',
      allocations: [
        {
          accountId: 31,
          accountCode: '50000001',
          amount: '75.50',
        },
      ],
    });
    expect(transaction.accountingPayment.create).not.toHaveBeenCalled();
  });
});

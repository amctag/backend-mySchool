import { BadRequestException } from '@nestjs/common';
import { AccountCodeService } from './account-code.service';
import { DashboardAccountingService } from './dashboard-accounting.service';

type RawQueryMock = ((...args: unknown[]) => Promise<unknown>) & {
  mock: { calls: unknown[][] };
};

type ListWhere = {
  schoolId?: number;
  accountingRegister?: {
    dailyEntries?: { some?: unknown };
    dateCreated?: { gte?: Date; lte?: Date };
    OR?: unknown[];
  };
};

type ListStore = ((...args: unknown[]) => Promise<unknown>) & {
  mock: {
    calls: Array<
      [
        {
          where: ListWhere;
          skip?: number;
          take?: number;
        },
      ]
    >;
  };
};

function asRawMock(value: unknown): RawQueryMock {
  return value as RawQueryMock;
}

function asListStore(value: unknown): ListStore {
  return value as ListStore;
}

function leafTx(codeRows: Array<{ code: string }>, counterSeq: number) {
  const $queryRaw = asRawMock(
    jest
      .fn()
      .mockResolvedValueOnce([{ seq: counterSeq }])
      .mockResolvedValueOnce(codeRows)
      .mockResolvedValueOnce([]),
  );
  return { $queryRaw };
}

describe('AccountCodeService parent allocation', () => {
  const service = new AccountCodeService();

  it('allocates 41110002 after existing 41110001 in the same school', async () => {
    const tx = leafTx([{ code: '41110001' }], 1);
    await expect(
      service.allocateCustomerLeafCode(tx as never, 1),
    ).resolves.toBe('41110002');
  });

  it('continues monotonically to 41110003 (never reuses gaps)', async () => {
    const tx = leafTx([{ code: '41110002' }], 2);
    await expect(
      service.allocateCustomerLeafCode(tx as never, 1),
    ).resolves.toBe('41110003');
  });

  it('starts an independent school at 41110001', async () => {
    const tx = leafTx([], 0);
    await expect(
      service.allocateCustomerLeafCode(tx as never, 2),
    ).resolves.toBe('41110001');
    // Counter row is keyed per (school_id, prefix): school 2 gets its own row.
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(2);
  });

  it('never falls back to legacy 100xxx codes', async () => {
    const tx = leafTx([{ code: '41110007' }], 7);
    const code = await service.allocateCustomerLeafCode(tx as never, 1);
    expect(code).toBe('41110008');
    expect(code).not.toMatch(/^100/);
  });

  it('advances past concurrent commits instead of duplicating', async () => {
    // Another transaction committed up to seq 5 while existing rows lag at 3.
    const tx = leafTx([{ code: '41110003' }], 5);
    await expect(
      service.allocateCustomerLeafCode(tx as never, 1),
    ).resolves.toBe('41110006');
  });

  it('locks the per-school counter row before reading existing codes', async () => {
    const tx = leafTx([], 0);
    await service.allocateCustomerLeafCode(tx as never, 1);
    const firstSql = (tx.$queryRaw.mock.calls[0][0] as string[]).join(' ');
    expect(firstSql).toContain('account_code_counters');
    expect(firstSql).toContain('ON CONFLICT');
  });

  it('fails cleanly when the same-school 4111 branch is missing', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      account: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    await expect(
      service.allocateCustomerPersonAccount(tx as never, 9),
    ).rejects.toThrow('Customer chart branch 4111 is not set up');
  });

  it('links the leaf to the same-school 4111 id', async () => {
    const branch = { id: 53, code: '4111', name: 'Ordinary', isGroup: true };
    const tx = {
      $queryRaw: asRawMock(
        jest
          .fn()
          .mockResolvedValueOnce([{ seq: 0 }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      ),
      account: { findFirst: jest.fn().mockResolvedValue(branch) },
    };
    await expect(
      service.allocateCustomerPersonAccount(tx as never, 3),
    ).resolves.toEqual({ code: '41110001', parentId: 53 });
  });
});

function listPrisma() {
  const accountingReceipt = {
    count: asListStore(jest.fn().mockResolvedValue(0)),
    findMany: asListStore(jest.fn().mockResolvedValue([])),
  };
  const accountingPayment = {
    count: asListStore(jest.fn().mockResolvedValue(0)),
    findMany: asListStore(jest.fn().mockResolvedValue([])),
  };
  const prisma = {
    $transaction: jest.fn((operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    $queryRaw: asRawMock(jest.fn()),
    accountingReceipt,
    accountingPayment,
    person: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return prisma;
}

function listService(prisma: ReturnType<typeof listPrisma>) {
  return new DashboardAccountingService(prisma as never);
}

const user = { schoolId: 3 } as never;

describe('Receipt/Payment server-side filtering', () => {
  it('applies accountId to the database query before pagination (receipts)', async () => {
    const prisma = listPrisma();
    await listService(prisma).listReceipts(user, { page: 1, accountId: 12 });
    for (const store of [
      prisma.accountingReceipt.count,
      prisma.accountingReceipt.findMany,
    ]) {
      const [args] = store.mock.calls[0];
      expect(args.where.schoolId).toBe(3);
      expect(args.where.accountingRegister?.dailyEntries).toEqual({
        some: { accountId: 12 },
      });
    }
    const [pageArgs] = prisma.accountingReceipt.findMany.mock.calls[0];
    expect(pageArgs.skip).toBe(0);
    expect(pageArgs.take).toBe(10);
  });

  it('applies accountId to the database query before pagination (payments)', async () => {
    const prisma = listPrisma();
    await listService(prisma).listPayments(user, { page: 1, accountId: 44 });
    const [args] = prisma.accountingPayment.count.mock.calls[0];
    expect(args.where.schoolId).toBe(3);
    expect(args.where.accountingRegister?.dailyEntries).toEqual({
      some: { accountId: 44 },
    });
  });

  it('finds matches beyond page 1 by filtering server-side, not loaded rows', async () => {
    const prisma = listPrisma();
    prisma.accountingReceipt.count = asListStore(
      jest.fn().mockResolvedValue(25),
    );
    const response = await listService(prisma).listReceipts(user, {
      page: 3,
      limit: 10,
      accountId: 12,
    });
    expect(response.total).toBe(25);
    expect(response.totalPages).toBe(3);
    const [args] = prisma.accountingReceipt.findMany.mock.calls[0];
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
    expect(args.where.accountingRegister?.dailyEntries).toEqual({
      some: { accountId: 12 },
    });
  });

  it('keeps active filters while paginating', async () => {
    const prisma = listPrisma();
    await listService(prisma).listPayments(user, {
      page: 2,
      accountId: 44,
      search: 'tuition',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });
    const [args] = prisma.accountingPayment.findMany.mock.calls[0];
    expect(args.skip).toBe(10);
    expect(args.where.schoolId).toBe(3);
    expect(args.where.accountingRegister?.dailyEntries).toEqual({
      some: { accountId: 44 },
    });
    expect(args.where.accountingRegister?.OR).toHaveLength(2);
    expect(args.where.accountingRegister?.dateCreated?.gte).toEqual(
      new Date('2026-09-01'),
    );
  });

  it('filters fromDate only as date >= fromDate', async () => {
    const prisma = listPrisma();
    await listService(prisma).listReceipts(user, {
      dateFrom: '2026-09-01',
    });
    const [args] = prisma.accountingReceipt.count.mock.calls[0];
    expect(args.where.accountingRegister?.dateCreated?.gte).toEqual(
      new Date('2026-09-01'),
    );
    expect(args.where.accountingRegister?.dateCreated?.lte).toBeUndefined();
  });

  it('filters toDate only as date <= toDate (inclusive end of day)', async () => {
    const prisma = listPrisma();
    await listService(prisma).listReceipts(user, { dateTo: '2026-09-30' });
    const [args] = prisma.accountingReceipt.count.mock.calls[0];
    expect(args.where.accountingRegister?.dateCreated?.gte).toBeUndefined();
    expect(args.where.accountingRegister?.dateCreated?.lte).toEqual(
      new Date('2026-09-30T23:59:59.999Z'),
    );
  });

  it('rejects fromDate after toDate with a clean validation error', async () => {
    const prisma = listPrisma();
    await expect(
      listService(prisma).listReceipts(user, {
        dateFrom: '2026-09-30',
        dateTo: '2026-09-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      listService(prisma).listPayments(user, {
        dateFrom: '2026-09-30',
        dateTo: '2026-09-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('isolates receipt/payment lists per school', async () => {
    const prisma = listPrisma();
    await listService(prisma).listReceipts({ schoolId: 7 } as never, {
      accountId: 12,
    });
    const [args] = prisma.accountingReceipt.count.mock.calls[0];
    expect(args.where.schoolId).toBe(7);
  });
});

describe('Posting account lookup', () => {
  function lookupPrisma(
    rows: Array<{
      id: number;
      code: string;
      name: string;
      personName: string | null;
      parentId: number | null;
    }>,
  ) {
    const prisma = listPrisma();
    prisma.$queryRaw = asRawMock(jest.fn().mockResolvedValue(rows));
    return prisma;
  }

  it('returns family-4 posting leaves with person names', async () => {
    const prisma = lookupPrisma([
      {
        id: 12,
        code: '41110001',
        name: 'Ahmad Hassan Khalil',
        personName: 'Ahmad Hassan Khalil',
        parentId: 7,
      },
    ]);
    await expect(
      listService(prisma).lookupPostingAccounts(user, { family: '4' }),
    ).resolves.toEqual([
      {
        id: 12,
        code: '41110001',
        name: 'Ahmad Hassan Khalil',
        personName: 'Ahmad Hassan Khalil',
        parentId: 7,
      },
    ]);
  });

  it('scopes the lookup to the authenticated school', async () => {
    const prisma = lookupPrisma([]);
    await listService(prisma).lookupPostingAccounts({ schoolId: 5 } as never, {
      family: '5',
      search: 'bank',
    });
    const values = prisma.$queryRaw.mock.calls[0].slice(1);
    expect(values[0]).toBe(5);
  });

  it('caps the result limit for autocomplete use', async () => {
    const prisma = lookupPrisma([]);
    await listService(prisma).lookupPostingAccounts(user, {
      family: '4',
      limit: 500,
    });
    const values = prisma.$queryRaw.mock.calls[0].slice(1);
    expect(values[values.length - 1]).toBe(50);
  });

  it('rejects families other than 4 or 5', async () => {
    const prisma = lookupPrisma([]);
    await expect(
      listService(prisma).lookupPostingAccounts(user, { family: '6' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only matches 8-digit non-group codes of the requested family in SQL', async () => {
    const prisma = lookupPrisma([]);
    await listService(prisma).lookupPostingAccounts(user, { family: '4' });
    const template = (prisma.$queryRaw.mock.calls[0][0] as string[]).join(' ');
    expect(template).toContain('is_group = false');
    expect(template).toContain('LENGTH(a.code) = 8');
    expect(template).toContain('school_id');
  });
});

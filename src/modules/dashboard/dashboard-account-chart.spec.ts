import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountCodeService } from './account-code.service';
import { DashboardAccountingService } from './dashboard-accounting.service';

describe('Account code uniqueness is per-school', () => {
  const migrationSql = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'prisma',
      'migrations',
      '20261001120000_chart_of_accounts_hierarchy',
      'migration.sql',
    ),
    'utf8',
  );
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
    'utf8',
  );

  it('replaces the global code unique index with UNIQUE (school_id, code)', () => {
    // Same code (4111, 41110001, …) must be reusable across schools, while a
    // duplicate (school_id, code) pair is rejected by the database.
    expect(migrationSql).toContain('DROP INDEX IF EXISTS "accounts_code_key"');
    expect(migrationSql).toContain('UNIQUE ("school_id", "code")');
    expect(migrationSql).not.toMatch(/DROP TABLE/i);
    expect(migrationSql).not.toMatch(/DROP COLUMN/i);
  });

  it('declares @@unique([schoolId, code]) and no global @unique on code', () => {
    expect(schema).toContain('@@unique([schoolId, code])');
    expect(schema).not.toMatch(/code\s+String\s+@unique/);
  });
});

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function queuedQueryRaw(results: unknown[]) {
  const queue = [...results];
  return jest.fn(() => {
    const next = queue.shift();
    if (next instanceof Error) {
      throw next;
    }
    return Promise.resolve(next);
  });
}

function transactionMock(overrides?: {
  queryRawResults?: unknown[];
  accountFindFirst?: unknown;
  accountFindMany?: unknown[];
  accountFindUnique?: unknown;
  accountCreate?: unknown;
  accountCount?: number;
  accountUpdate?: unknown;
  dailyCount?: number;
  receiptDetailCount?: number;
  paymentDetailCount?: number;
  installmentCount?: number;
  personCount?: number;
}) {
  return {
    $queryRaw: queuedQueryRaw(overrides?.queryRawResults ?? []),
    account: {
      findFirst: jest.fn(() =>
        Promise.resolve(overrides?.accountFindFirst ?? null),
      ),
      findMany: jest.fn(() =>
        Promise.resolve(overrides?.accountFindMany ?? []),
      ),
      findUnique: jest.fn(() =>
        Promise.resolve(overrides?.accountFindUnique ?? null),
      ),
      create: jest.fn(() =>
        Promise.resolve(overrides?.accountCreate ?? { id: 1 }),
      ),
      update: jest.fn(() =>
        Promise.resolve(overrides?.accountUpdate ?? { id: 1 }),
      ),
      count: jest.fn(() =>
        Promise.resolve(overrides?.accountCount ?? 0),
      ),
      delete: jest.fn(() => Promise.resolve({ id: 1 })),
    },
    accountingDaily: {
      count: jest.fn(() => Promise.resolve(overrides?.dailyCount ?? 0)),
    },
    accountingReceiptDetail: {
      count: jest.fn(() =>
        Promise.resolve(overrides?.receiptDetailCount ?? 0),
      ),
    },
    accountingPaymentDetail: {
      count: jest.fn(() =>
        Promise.resolve(overrides?.paymentDetailCount ?? 0),
      ),
    },
    installment: {
      count: jest.fn(() =>
        Promise.resolve(overrides?.installmentCount ?? 0),
      ),
    },
    person: {
      findMany: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(overrides?.personCount ?? 0)),
    },
  };
}

function serviceWithTransaction(
  transaction: ReturnType<typeof transactionMock>,
  prismaOverrides?: Record<string, unknown>,
) {
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
    account: transaction.account,
    person: transaction.person,
    ...prismaOverrides,
  };
  return {
    service: new DashboardAccountingService(prisma as never),
    prisma,
  };
}

const school3 = { schoolId: 3 } as never;

describe('Chart of Accounts hierarchy', () => {
  it('lists root accounts with children flags', async () => {
    const roots = [
      {
        id: 50,
        code: '4',
        name: 'Third parties',
        type: 'GENERAL',
        parentId: null,
        isGroup: true,
      },
    ];
    const tx = transactionMock({
      accountFindMany: roots,
    });
    // First findMany call serves roots; second serves hasChildren lookup.
    tx.account.findMany
      .mockResolvedValueOnce(roots)
      .mockResolvedValueOnce([{ parentId: 50 }]);
    const { service } = serviceWithTransaction(tx);

    const result = await service.listRootAccounts(school3);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 50,
      code: '4',
      parentId: null,
      isGroup: true,
      hasChildren: true,
    });
  });

  it('lazy-loads direct children tenant-scoped, 404 for foreign accounts', async () => {
    const tx = transactionMock({
      accountFindFirst: { id: 51 },
      accountFindMany: [
        {
          id: 52,
          code: '411',
          name: 'Invoices',
          type: 'GENERAL',
          parentId: 51,
          isGroup: true,
        },
      ],
    });
    // children list, then persons, then hasChildren lookups
    tx.account.findMany
      .mockResolvedValueOnce([
        {
          id: 52,
          code: '411',
          name: 'Invoices',
          type: 'GENERAL',
          parentId: 51,
          isGroup: true,
        },
      ])
      .mockResolvedValueOnce([]);
    const { service, prisma } = serviceWithTransaction(tx);

    const children = await service.listAccountChildren(school3, 51);
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({ parentId: 51, code: '411' });
    expect(tx.account.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 51, schoolId: 3 },
      }),
    );
    void prisma;

    const foreign = transactionMock({ accountFindFirst: null });
    const { service: foreignService } = serviceWithTransaction(foreign);
    await expect(
      foreignService.listAccountChildren(school3, 999),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a root group account with an explicit structural code', async () => {
    const created = {
      id: 50,
      code: '4',
      name: 'Third parties',
      type: 'GENERAL',
      parentId: null,
      isGroup: true,
    };
    const tx = transactionMock({ accountCreate: created });
    const { service } = serviceWithTransaction(tx);

    const result = await service.createAccount(school3, {
      name: 'Third parties',
      type: 'GENERAL',
      code: '4',
      isGroup: true,
    } as never);

    expect(tx.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: '4',
          parentId: null,
          isGroup: true,
          schoolId: 3,
        }),
      }),
    );
    expect(result).toMatchObject({ code: '4', parentId: null, isGroup: true });
  });

  it('rejects duplicate codes', async () => {
    const tx = transactionMock({});
    tx.account.create.mockRejectedValueOnce(uniqueViolation());
    const { service } = serviceWithTransaction(tx);

    await expect(
      service.createAccount(school3, {
        name: 'Dup',
        type: 'GENERAL',
        code: '4',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores child parentId as the parent account id and enforces code prefix', async () => {
    const created = {
      id: 51,
      code: '41',
      name: 'Customers',
      type: 'GENERAL',
      parentId: 50,
      isGroup: true,
    };
    const tx = transactionMock({
      accountFindFirst: { id: 50, code: '4', name: 'Root', isGroup: true },
      accountCreate: created,
      // branch counter sync after explicit create: max-code select + upsert
      queryRawResults: [[], []],
    });
    const { service } = serviceWithTransaction(tx);

    const result = await service.createAccount(school3, {
      name: 'Customers',
      type: 'GENERAL',
      parentId: 50,
      code: '41',
      isGroup: true,
    } as never);

    expect(tx.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: 50, code: '41' }),
      }),
    );
    expect(result).toMatchObject({ parentId: 50, code: '41' });

    await expect(
      service.createAccount(school3, {
        name: 'Bad',
        type: 'GENERAL',
        parentId: 50,
        code: '5',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects children under posting accounts and cross-school parents', async () => {
    const posting = transactionMock({
      accountFindFirst: { id: 60, code: '100001', name: 'Cash', isGroup: false },
    });
    const { service } = serviceWithTransaction(posting);
    await expect(
      service.createAccount(school3, {
        name: 'Child',
        type: 'GENERAL',
        parentId: 60,
        code: '1000011',
      } as never),
    ).rejects.toThrow('group account');

    const foreign = transactionMock({ accountFindFirst: null });
    const { service: foreignService } = serviceWithTransaction(foreign);
    await expect(
      foreignService.createAccount(school3, {
        name: 'Child',
        type: 'GENERAL',
        parentId: 77,
        code: '41',
      } as never),
    ).rejects.toThrow('authenticated school');
  });

  it('allocates the first 8-digit PERSON leaf 41110001 under 4111', async () => {
    const created = {
      id: 100,
      code: '41110001',
      name: 'Parent A',
      type: 'PERSON',
      parentId: 53,
      isGroup: false,
    };
    const tx = transactionMock({
      accountFindFirst: { id: 53, code: '4111', name: 'Ordinary', isGroup: true },
      accountFindUnique: null,
      accountCreate: created,
      // allocate: ensure+lock counter -> 0, max existing -> none, bump;
      // sync: max-code select + upsert
      queryRawResults: [
        [{ seq: 0 }],
        [],
        [],
        [{ code: '41110001' }],
        [],
      ],
    });
    const { service } = serviceWithTransaction(tx);

    const result = await service.createAccount(school3, {
      name: 'Parent A',
      type: 'PERSON',
      parentId: 53,
    } as never);

    expect(result).toMatchObject({
      code: '41110001',
      parentId: 53,
      isGroup: false,
      type: 'PERSON',
    });
    expect(tx.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentId: 53, isGroup: false }),
      }),
    );
  });

  it('rejects non-PERSON children, explicit codes, and PERSON outside 4111', async () => {
    const branch = transactionMock({
      accountFindFirst: { id: 53, code: '4111', name: 'Ordinary', isGroup: true },
    });
    const { service } = serviceWithTransaction(branch);
    await expect(
      service.createAccount(school3, {
        name: 'G',
        type: 'GENERAL',
        parentId: 53,
        code: '4112',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createAccount(school3, {
        name: 'P',
        type: 'PERSON',
        parentId: 53,
        code: '41110001',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    const other = transactionMock({
      accountFindFirst: { id: 52, code: '411', name: 'Invoices', isGroup: true },
    });
    const { service: otherService } = serviceWithTransaction(other);
    await expect(
      otherService.createAccount(school3, {
        name: 'P',
        type: 'PERSON',
        parentId: 52,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('previews 41110004 after 41110001..41110003', async () => {
    const tx = transactionMock({
      accountFindFirst: { id: 53, code: '4111', name: 'Ordinary' },
      queryRawResults: [[{ seq: 3 }], [{ code: '41110003' }]],
    });
    const prisma = {
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      ),
      account: tx.account,
    };
    const service = new DashboardAccountingService(prisma as never);

    const preview = await service.getNextChildCode(school3, 53);
    expect(preview).toMatchObject({
      parentId: 53,
      parentCode: '4111',
      expectedCode: '41110004',
      autoAllocatable: true,
      requiredLength: 8,
    });
  });

  it('proposes next structural codes with required lengths', async () => {
    async function previewFor(
      parent: { id: number; code: string; name: string },
      queryRawResults: unknown[],
    ) {
      const tx = transactionMock({
        accountFindFirst: parent,
        queryRawResults,
      });
      const prisma = {
        $transaction: jest.fn(
          async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
        ),
        account: tx.account,
      };
      return new DashboardAccountingService(prisma as never).getNextChildCode(
        school3,
        parent.id,
      );
    }

    // Parent 41 with no children -> 410, required length 3.
    await expect(
      previewFor({ id: 51, code: '41', name: 'Customers' }, [[{ seq: -1 }], []]),
    ).resolves.toMatchObject({
      expectedCode: '410',
      autoAllocatable: true,
      requiredLength: 3,
    });

    // Parent 5 with children 50,51 -> 52.
    await expect(
      previewFor(
        { id: 60, code: '5', name: 'Finance' },
        [[{ seq: 0 }], [{ code: '51' }, { code: '50' }]],
      ),
    ).resolves.toMatchObject({
      expectedCode: '52',
      autoAllocatable: true,
      requiredLength: 2,
    });

    // Parent 5000 with no children -> 50000000.
    await expect(
      previewFor({ id: 61, code: '5000', name: 'Cash' }, [[{ seq: -1 }], []]),
    ).resolves.toMatchObject({
      expectedCode: '50000000',
      autoAllocatable: true,
      requiredLength: 8,
    });

    // Final 8-digit accounts cannot have children.
    await expect(
      previewFor({ id: 62, code: '50000000', name: 'Leaf' }, []),
    ).resolves.toMatchObject({
      expectedCode: null,
      autoAllocatable: false,
      requiredLength: null,
    });
  });

  it('blocks deletion with children, journal refs, or person links', async () => {
    const withChildren = transactionMock({
      accountFindFirst: { id: 50, code: '4', name: 'R', type: 'GENERAL' },
      accountCount: 2,
    });
    const { service: s1 } = serviceWithTransaction(withChildren);
    await expect(s1.deleteAccount(school3, 50)).rejects.toThrow(
      'child accounts',
    );

    const journalUsed = transactionMock({
      accountFindFirst: { id: 60, code: '100001', name: 'C', type: 'GENERAL' },
      accountCount: 0,
      dailyCount: 3,
    });
    const { service: s2 } = serviceWithTransaction(journalUsed);
    await expect(s2.deleteAccount(school3, 60)).rejects.toThrow('journal');

    const personLinked = transactionMock({
      accountFindFirst: { id: 70, code: '41110001', name: 'P', type: 'PERSON' },
      accountCount: 0,
      personCount: 1,
    });
    const { service: s3 } = serviceWithTransaction(personLinked);
    await expect(s3.deleteAccount(school3, 70)).rejects.toThrow('person');

    const clean = transactionMock({
      accountFindFirst: { id: 80, code: '99', name: 'X', type: 'GENERAL' },
      accountCount: 0,
    });
    const { service: s4 } = serviceWithTransaction(clean);
    await expect(s4.deleteAccount(school3, 80)).resolves.toEqual({ id: 80 });
    expect(clean.account.delete).toHaveBeenCalledWith({ where: { id: 80 } });
  });

  it('excludes group accounts from manual record postings', async () => {
    const tx = transactionMock({
      accountFindMany: [
        { id: 50, isGroup: true },
        { id: 60, isGroup: false },
      ],
    });
    const { service } = serviceWithTransaction(tx);
    await expect(
      service.createRecord(school3, {
        currencyId: 1,
        rows: [
          { accountId: 50, debit: 100, credit: 0 },
          { accountId: 60, debit: 0, credit: 100 },
        ],
      } as never),
    ).rejects.toThrow('Group accounts');
  });

  it('blocks converting a group with children into a posting account', async () => {
    const tx = transactionMock({
      accountFindFirst: {
        id: 50,
        code: '4',
        name: 'R',
        type: 'GENERAL',
        parentId: null,
        isGroup: true,
      },
      accountCount: 2,
      accountUpdate: {},
    });
    const { service } = serviceWithTransaction(tx);
    await expect(
      service.updateAccount(school3, 50, { isGroup: false } as never),
    ).rejects.toThrow('children');
    expect(tx.account.update).not.toHaveBeenCalled();
  });
});

describe('AccountCodeService (shared allocator)', () => {
  function codeTx(results: unknown[], findUniqueResult: unknown = null) {
    return {
      $queryRaw: queuedQueryRaw(results),
      account: {
        findUnique: jest.fn(() => Promise.resolve(findUniqueResult)),
      },
    } as never;
  }

  it('previews 41110001 on an empty branch', async () => {
    const service = new AccountCodeService();
    const code = await service.previewCustomerLeafCode(
      codeTx([[], []]),
      3,
    );
    expect(code).toBe('41110001');
  });

  it('previews 41110002 after 41110001 exists', async () => {
    const service = new AccountCodeService();
    const code = await service.previewCustomerLeafCode(
      codeTx([[], [{ code: '41110001' }]]),
      3,
    );
    expect(code).toBe('41110002');
  });

  it('initializes from existing children with no counter row (-> 41110004)', async () => {
    const service = new AccountCodeService();
    // ensure+lock -> 0 (fresh row), max existing -> 41110003, bump
    const code = await service.allocateCustomerLeafCode(
      codeTx([[{ seq: 0 }], [{ code: '41110003' }], []]),
      3,
    );
    expect(code).toBe('41110004');
  });

  it('never reuses gaps: counter 2 with existing 41110004 -> 41110005', async () => {
    const service = new AccountCodeService();
    const code = await service.allocateCustomerLeafCode(
      codeTx([[{ seq: 2 }], [{ code: '41110004' }], []]),
      3,
    );
    expect(code).toBe('41110005');
  });

  it('never recycles deleted codes: counter 10 with lower existing max -> 41110011', async () => {
    const service = new AccountCodeService();
    const code = await service.allocateCustomerLeafCode(
      codeTx([[{ seq: 10 }], [{ code: '41110007' }], []]),
      3,
    );
    expect(code).toBe('41110011');
  });

  it('keeps school counters independent (school 1 and 2 both start at 41110001)', async () => {
    const service = new AccountCodeService();
    const seen: Array<{ schoolId: number; prefix: string }> = [];
    const schoolTx = (schoolId: number) =>
      ({
        $queryRaw: jest.fn(
          (sql: TemplateStringsArray, ...values: unknown[]) => {
            const text = sql.join('?');
            if (
              text.includes('account_code_counters') &&
              text.includes('RETURNING')
            ) {
              seen.push({
                schoolId: values[0] as number,
                prefix: values[1] as string,
              });
              return Promise.resolve([{ seq: 0 }]);
            }
            return Promise.resolve([]);
          },
        ),
      }) as never;
    await expect(
      service.allocateCustomerLeafCode(schoolTx(1), 1),
    ).resolves.toBe('41110001');
    await expect(
      service.allocateCustomerLeafCode(schoolTx(2), 2),
    ).resolves.toBe('41110001');
    expect(seen).toEqual([
      { schoolId: 1, prefix: '4111' },
      { schoolId: 2, prefix: '4111' },
    ]);
  });

  it('derives each allocation from the committed counter (11 then 12)', async () => {
    const service = new AccountCodeService();
    // Emulates Postgres row-lock serialization: the shared counter row is
    // read-modify-written atomically per transaction, so serialized
    // allocations can never repeat a code (mutual exclusion itself is the
    // row lock, reviewed in code).
    let lastSeq = 10;
    const contendedTx = () =>
      ({
        $queryRaw: jest.fn(
          (sql: TemplateStringsArray, ...values: unknown[]) => {
            const text = sql.join('?');
            if (text.includes('RETURNING')) {
              return Promise.resolve([{ seq: lastSeq }]);
            }
            if (text.includes('UPDATE "account_code_counters"')) {
              lastSeq = Math.max(lastSeq, values[0] as number);
              return Promise.resolve([]);
            }
            return Promise.resolve([]);
          },
        ),
      }) as never;
    const first = await service.allocateCustomerLeafCode(contendedTx(), 1);
    const second = await service.allocateCustomerLeafCode(contendedTx(), 1);
    expect(first).toBe('41110011');
    expect(second).toBe('41110012');
  });

  it('resolves the 4111 branch by school+code and never falls back silently', async () => {
    const service = new AccountCodeService();
    const branchTx = (
      branch: { id: number; code: string; isGroup: boolean } | null,
      counter: unknown[] = [[{ seq: 6 }], [], []],
    ) =>
      ({
        $queryRaw: queuedQueryRaw(counter),
        account: {
          findFirst: jest.fn(() => Promise.resolve(branch)),
          findUnique: jest.fn(() => Promise.resolve(null)),
        },
      }) as never;

    await expect(
      service.allocateCustomerPersonAccount(branchTx(null), 3),
    ).rejects.toThrow('4111');
    await expect(
      service.allocateCustomerPersonAccount(
        branchTx({ id: 53, code: '4111', isGroup: false }),
        3,
      ),
    ).rejects.toThrow('group');
    await expect(
      service.allocateCustomerPersonAccount(
        branchTx({ id: 53, code: '4111', isGroup: true }),
        3,
      ),
    ).resolves.toEqual({ code: '41110007', parentId: 53 });
  });

  it('rejects exhausted ranges without MAX(code)+1 races', async () => {
    const service = new AccountCodeService();
    await expect(
      service.previewCustomerLeafCode(codeTx([[{ seq: 9999 }], []]), 3),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.allocateCustomerLeafCode(codeTx([[{ seq: 10000 }], []]), 3),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('Strict code hierarchy (1->2->3->4->8 digits)', () => {
  it.each([
    ['5', '50'],
    ['5', '51'],
    ['5', '59'],
    ['50', '500'],
    ['50', '509'],
    ['500', '5000'],
    ['500', '5009'],
    ['5000', '50000000'],
    ['5000', '50000001'],
    ['5000', '50009999'],
    ['4', '41'],
    ['41', '411'],
    ['411', '4111'],
    ['4111', '41110001'],
  ])('accepts %s -> %s', (parent, child) => {
    expect(() =>
      AccountCodeService.validateHierarchyCode(parent, child),
    ).not.toThrow();
  });

  it.each([
    ['5', '60', 'prefix'],
    ['5', '500', 'length'],
    ['5', '5000', 'length'],
    ['5', '5', 'length'],
    ['50', '510', 'prefix'],
    ['50', '51', 'length'],
    ['50', '5000', 'length'],
    ['500', '50000', 'length'],
    ['500', '500', 'length'],
    ['5000', '50001', 'length'],
    ['5000', '500000000', 'length'],
    ['5000', '5000000A', 'digits'],
    ['50000000', '500000000', 'final'],
    ['41110001', '411100010', 'final'],
    ['5', ' 50', 'spaces'],
    ['5', '50 ', 'spaces'],
    ['5', '5.0', 'digits'],
    ['5', '-51', 'digits'],
    ['5', '', 'digits'],
    ['5', '5A', 'digits'],
  ])('rejects %s -> %s', (parent, child) => {
    expect(() => AccountCodeService.validateHierarchyCode(parent, child)).toThrow(
      BadRequestException,
    );
  });

  it.each([['1'], ['4'], ['9'], ['0']])(
    'accepts root code %s',
    (code) => {
      expect(() => AccountCodeService.validateRootCode(code)).not.toThrow();
    },
  );

  it.each([['10'], ['41'], [''], ['A'], [' 4'], ['4 '], ['4.0'], ['-1']])(
    'rejects root code %s',
    (code) => {
      expect(() => AccountCodeService.validateRootCode(code)).toThrow(
        BadRequestException,
      );
    },
  );

  it('reports exact required child lengths per level', () => {
    expect(AccountCodeService.childCodeLengthFor('5')).toBe(2);
    expect(AccountCodeService.childCodeLengthFor('50')).toBe(3);
    expect(AccountCodeService.childCodeLengthFor('500')).toBe(4);
    expect(AccountCodeService.childCodeLengthFor('5000')).toBe(8);
    expect(AccountCodeService.childCodeLengthFor('50000000')).toBeNull();
    expect(AccountCodeService.childCodeLengthFor('4A')).toBeNull();
    expect(AccountCodeService.childCodeLengthFor('')).toBeNull();
  });
});

describe('Strict structural child creation', () => {
  const parent5 = { id: 60, code: '5', name: 'Finance', isGroup: true };

  function childService(
    parent: { id: number; code: string; name: string; isGroup: boolean },
    queryRawResults: unknown[] = [],
    accountCreate?: unknown,
  ) {
    const tx = transactionMock({
      accountFindFirst: parent,
      queryRawResults,
      accountCreate,
    });
    return serviceWithTransaction(tx);
  }

  it('creates 5 -> 50 with an explicit valid code and syncs the branch', async () => {
    const created = {
      id: 61,
      code: '50',
      name: 'Cash',
      type: 'GENERAL',
      parentId: 60,
      isGroup: true,
    };
    const { service, prisma } = childService(parent5, [[], []], created);
    void prisma;

    const result = await service.createAccount(school3, {
      name: 'Cash',
      type: 'GENERAL',
      parentId: 60,
      code: '50',
      isGroup: true,
    } as never);

    expect(result).toMatchObject({ code: '50', parentId: 60 });
  });

  it('auto-allocates 5 -> 50 when no code is given', async () => {
    const created = {
      id: 61,
      code: '50',
      name: 'Cash',
      type: 'GENERAL',
      parentId: 60,
      isGroup: true,
    };
    // allocate: ensure+lock (-1 fresh), max existing (none), bump;
    // sync: max-code select + upsert
    const { service } = childService(
      parent5,
      [[{ seq: -1 }], [], [], [], []],
      created,
    );

    const result = await service.createAccount(school3, {
      name: 'Cash',
      type: 'GENERAL',
      parentId: 60,
    } as never);

    expect(result).toMatchObject({ code: '50', parentId: 60 });
  });

  it.each([
    ['60 under 5', '5', '60'],
    ['500 under 5', '5', '500'],
    ['5000 under 5', '5', '5000'],
    ['510 under 50', '50', '510'],
    ['5000 under 50', '50', '5000'],
    ['50000 under 500', '500', '50000'],
    ['50001 under 5000', '5000', '50001'],
    ['500000000 under 5000', '5000', '500000000'],
    ['non-numeric under 5', '5', '5A'],
    ['whitespace under 5', '5', ' 50'],
    ['decimal under 5', '5', '5.0'],
  ])('rejects invalid %s without writing', async (_label, parentCode, code) => {
    const { service, prisma } = childService({
      id: 70,
      code: parentCode,
      name: 'Parent',
      isGroup: true,
    });

    await expect(
      service.createAccount(school3, {
        name: 'Bad',
        type: 'GENERAL',
        parentId: 70,
        code,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it('rejects children under final 8-digit accounts', async () => {
    const { service, prisma } = childService({
      id: 80,
      code: '50000000',
      name: 'Leaf',
      isGroup: true,
    });

    await expect(
      service.createAccount(school3, {
        name: 'Too deep',
        type: 'GENERAL',
        parentId: 80,
        code: '500000000',
      } as never),
    ).rejects.toThrow('final posting account');
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate codes in the same school', async () => {
    const tx = transactionMock({
      accountFindFirst: parent5,
      queryRawResults: [[], []],
    });
    tx.account.create.mockRejectedValueOnce(uniqueViolation());
    const { service } = serviceWithTransaction(tx);

    await expect(
      service.createAccount(school3, {
        name: 'Dup',
        type: 'GENERAL',
        parentId: 60,
        code: '50',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows the same code in a different school', async () => {
    const created = {
      id: 71,
      code: '50',
      name: 'Cash',
      type: 'GENERAL',
      parentId: 60,
      isGroup: true,
    };
    const tx = transactionMock({
      accountFindFirst: parent5,
      queryRawResults: [[], []],
      accountCreate: created,
    });
    const { service } = serviceWithTransaction(tx);

    // Same code 50 already exists for school 3; school 4 has its own scope.
    const result = await service.createAccount({ schoolId: 4 } as never, {
      name: 'Cash',
      type: 'GENERAL',
      parentId: 60,
      code: '50',
    } as never);

    expect(result).toMatchObject({ code: '50' });
    expect(tx.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: 4, code: '50' }),
      }),
    );
  });

  it('rejects root codes that are not exactly one digit', async () => {
    const { service, prisma } = childService(parent5);

    for (const code of ['10', '41', 'AB', '']) {
      await expect(
        service.createAccount(school3, {
          name: 'Bad root',
          type: 'GENERAL',
          code,
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(prisma.account.create).not.toHaveBeenCalled();
  });

  it('auto-allocates structural children sequentially without reuse', async () => {
    // Shared mutable counter emulating Postgres row-lock serialization for
    // branch (school 3, parent 5); existing children 50,51.
    let lastSeq = -1;
    const existing = [{ code: '51' }, { code: '50' }];
    const $queryRaw = jest.fn(
      (sql: TemplateStringsArray, ...values: unknown[]) => {
        const text = sql.join('?');
        if (text.includes('RETURNING')) {
          return Promise.resolve([{ seq: lastSeq }]);
        }
        if (text.includes('UPDATE "account_code_counters"')) {
          lastSeq = Math.max(lastSeq, values[0] as number);
          return Promise.resolve([]);
        }
        return Promise.resolve(existing);
      },
    );
    const codes: string[] = [];
    const tx = {
      $queryRaw,
      account: {
        findFirst: jest.fn(() => Promise.resolve(parent5)),
        create: jest.fn((args: { data: { code: string } }) => {
          codes.push(args.data.code);
          return Promise.resolve({ id: codes.length, ...args.data });
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (t: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
      account: tx.account,
      person: { findMany: jest.fn(() => Promise.resolve([])) },
    };
    const service = new DashboardAccountingService(prisma as never);

    for (const expected of ['52', '53']) {
      const created = await service.createAccount(school3, {
        name: `Child ${expected}`,
        type: 'GENERAL',
        parentId: 60,
      } as never);
      expect(created.code).toBe(expected);
    }
    expect(codes).toEqual(['52', '53']);
  });
});

describe('Structural next-code previews', () => {
  async function previewFor(
    parent: { id: number; code: string; name: string },
    queryRawResults: unknown[],
  ) {
    const tx = transactionMock({
      accountFindFirst: parent,
      queryRawResults,
    });
    const prisma = {
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
      ),
      account: tx.account,
    };
    return new DashboardAccountingService(prisma as never).getNextChildCode(
      school3,
      parent.id,
    );
  }

  it('proposes 50 for parent 5 with no children', async () => {
    await expect(
      previewFor({ id: 60, code: '5', name: 'Finance' }, [[{ seq: -1 }], []]),
    ).resolves.toMatchObject({
      expectedCode: '50',
      autoAllocatable: true,
      requiredLength: 2,
    });
  });

  it('proposes 52 for parent 5 with children 50,51', async () => {
    await expect(
      previewFor(
        { id: 60, code: '5', name: 'Finance' },
        [[{ seq: -1 }], [{ code: '51' }, { code: '50' }]],
      ),
    ).resolves.toMatchObject({
      expectedCode: '52',
      autoAllocatable: true,
      requiredLength: 2,
    });
  });

  it('proposes 500 for parent 50 with no children', async () => {
    await expect(
      previewFor({ id: 61, code: '50', name: 'Cash' }, [[{ seq: -1 }], []]),
    ).resolves.toMatchObject({
      expectedCode: '500',
      autoAllocatable: true,
      requiredLength: 3,
    });
  });

  it('proposes 502 for parent 50 with children 500,501', async () => {
    await expect(
      previewFor(
        { id: 61, code: '50', name: 'Cash' },
        [[{ seq: 1 }], [{ code: '501' }, { code: '500' }]],
      ),
    ).resolves.toMatchObject({
      expectedCode: '502',
      autoAllocatable: true,
      requiredLength: 3,
    });
  });

  it('proposes 5000 for parent 500 with no children', async () => {
    await expect(
      previewFor({ id: 62, code: '500', name: 'Bank' }, [[{ seq: -1 }], []]),
    ).resolves.toMatchObject({
      expectedCode: '5000',
      autoAllocatable: true,
      requiredLength: 4,
    });
  });

  it('proposes 50000000 for parent 5000 with no children', async () => {
    await expect(
      previewFor({ id: 63, code: '5000', name: 'Vault' }, [[{ seq: -1 }], []]),
    ).resolves.toMatchObject({
      expectedCode: '50000000',
      autoAllocatable: true,
      requiredLength: 8,
    });
  });

  it('proposes 50000001 for parent 5000 with child 50000000', async () => {
    await expect(
      previewFor(
        { id: 63, code: '5000', name: 'Vault' },
        [[{ seq: 0 }], [{ code: '50000000' }]],
      ),
    ).resolves.toMatchObject({
      expectedCode: '50000001',
      autoAllocatable: true,
      requiredLength: 8,
    });
  });
});

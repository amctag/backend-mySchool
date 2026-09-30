import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DashboardParentsService } from './dashboard-parents.service';

const branch4111 = { id: 53, code: '4111', name: 'Ordinary', isGroup: true };

function accountingTransaction(overrides?: {
  lockedParent?: Array<{
    parentId: number;
    personId: number;
    accountId: number | null;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  }>;
  account?: { id: number; code: string; schoolId: number } | null;
  branch?: typeof branch4111 | null;
}) {
  const hasBranch = overrides !== undefined && 'branch' in overrides;
  // lockParent; allocate: ensure+lock counter (last=0), max existing (none),
  // bump; sync: max-code select, upsert
  const $queryRaw = jest
    .fn()
    .mockResolvedValueOnce(
      overrides?.lockedParent ?? [
        {
          parentId: 7,
          personId: 70,
          accountId: null,
          firstName: 'Ahmad',
          middleName: 'Hassan',
          lastName: 'Khalil',
        },
      ],
    )
    .mockResolvedValueOnce([{ seq: 0 }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ code: '41110001' }])
    .mockResolvedValueOnce([]);
  const account = {
    findFirst: jest.fn((args: { where?: { code?: string } }) => {
      if (args?.where?.code === '4111') {
        return Promise.resolve(hasBranch ? overrides?.branch : branch4111);
      }
      return Promise.resolve(overrides?.account ?? null);
    }),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest
      .fn()
      .mockResolvedValue({ id: 12, code: '41110001', schoolId: 3 }),
  };
  const person = { update: jest.fn().mockResolvedValue({ id: 70 }) };

  return { $queryRaw, account, person };
}

function serviceWithTransaction(
  transaction: ReturnType<typeof accountingTransaction>,
) {
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  };
  return new DashboardParentsService(prisma as never);
}

describe('DashboardParentsService accounting accounts', () => {
  it('creates a PERSON leaf under 4111 and links it atomically', async () => {
    const transaction = accountingTransaction();
    const service = serviceWithTransaction(transaction);

    await expect(
      service.createAccountingAccount({ schoolId: 3 } as never, 7),
    ).resolves.toEqual({
      accountId: 12,
      accountCode: '41110001',
      hasAccountingAccount: true,
    });
    expect(transaction.account.create).toHaveBeenCalledWith({
      data: {
        code: '41110001',
        name: 'Ahmad Hassan Khalil',
        type: 'PERSON',
        schoolId: 3,
        parentId: 53,
        isGroup: false,
      },
      select: { id: true, code: true, schoolId: true },
    });
    expect(transaction.person.update).toHaveBeenCalledWith({
      where: { id: 70 },
      data: { accountId: 12 },
    });
  });

  it('returns the existing school-owned account without creating another', async () => {
    const transaction = accountingTransaction({
      lockedParent: [{ parentId: 7, personId: 70, accountId: 12 }],
      account: { id: 12, code: '41110001', schoolId: 3 },
    });
    const service = serviceWithTransaction(transaction);

    await expect(
      service.createAccountingAccount({ schoolId: 3 } as never, 7),
    ).resolves.toEqual({
      accountId: 12,
      accountCode: '41110001',
      hasAccountingAccount: true,
    });
    expect(transaction.account.create).not.toHaveBeenCalled();
    expect(transaction.person.update).not.toHaveBeenCalled();
  });

  it('fails cleanly when the school has no 4111 branch', async () => {
    const transaction = accountingTransaction({ branch: null });
    const service = serviceWithTransaction(transaction);

    const attempt = service.createAccountingAccount({ schoolId: 3 } as never, 7);
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow('4111');
    expect(transaction.account.create).not.toHaveBeenCalled();
    expect(transaction.person.update).not.toHaveBeenCalled();
  });

  it('rejects a parent outside the authenticated school', async () => {
    const transaction = accountingTransaction({ lockedParent: [] });
    const service = serviceWithTransaction(transaction);

    await expect(
      service.createAccountingAccount({ schoolId: 3 } as never, 7),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.account.create).not.toHaveBeenCalled();
  });
});

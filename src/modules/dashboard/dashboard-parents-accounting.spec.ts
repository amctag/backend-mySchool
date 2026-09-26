import { NotFoundException } from '@nestjs/common';
import { DashboardParentsService } from './dashboard-parents.service';

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
}) {
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
    .mockResolvedValueOnce([{ code: '100001' }]);
  const account = {
    findFirst: jest.fn().mockResolvedValue(overrides?.account ?? null),
    create: jest
      .fn()
      .mockResolvedValue({ id: 12, code: '100001', schoolId: 3 }),
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
  it('creates and links a school-owned account atomically', async () => {
    const transaction = accountingTransaction();
    const service = serviceWithTransaction(transaction);

    await expect(
      service.createAccountingAccount({ schoolId: 3 } as never, 7),
    ).resolves.toEqual({
      accountId: 12,
      accountCode: '100001',
      hasAccountingAccount: true,
    });
    expect(transaction.account.create).toHaveBeenCalledWith({
      data: {
        code: '100001',
        name: 'Ahmad Hassan Khalil',
        type: 'PERSON',
        schoolId: 3,
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
      account: { id: 12, code: '100001', schoolId: 3 },
    });
    const service = serviceWithTransaction(transaction);

    await expect(
      service.createAccountingAccount({ schoolId: 3 } as never, 7),
    ).resolves.toEqual({
      accountId: 12,
      accountCode: '100001',
      hasAccountingAccount: true,
    });
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

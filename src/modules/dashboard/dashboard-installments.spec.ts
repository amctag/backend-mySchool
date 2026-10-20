import { DashboardAccountingService } from './dashboard-accounting.service';

function serviceWith(prisma: Record<string, unknown>) {
  return new DashboardAccountingService(prisma as never);
}

describe('Dashboard installment lifecycle', () => {
  it('applies tenant filters before pagination', async () => {
    const whereCalls: unknown[] = [];
    const prisma = {
      $transaction: jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
      installment: {
        count: jest.fn((args) => { whereCalls.push(args.where); return Promise.resolve(101); }),
        findMany: jest.fn((args) => { whereCalls.push(args.where); return Promise.resolve([]); }),
      },
    };
    const result = await serviceWith(prisma).listInstallments({ schoolId: 9 } as never, { page: 2, limit: 100, accountId: 4, yearId: 7, paid: false, date: '2026-01-10' });
    expect(result.totalPages).toBe(2);
    expect(whereCalls[0]).toMatchObject({ accountId: 4, yearId: 7, paid: false, year: { schoolId: 9 } });
    expect(whereCalls[1]).toMatchObject({ accountId: 4, yearId: 7, paid: false, year: { schoolId: 9 } });
  });

  it('creates a batch inside one transaction without receipt IDs', async () => {
    const tx = {
      account: { findMany: jest.fn().mockResolvedValue([{ id: 4 }]) },
      year: { findMany: jest.fn().mockResolvedValue([{ id: 7 }]) },
      installment: { create: jest.fn().mockResolvedValue({ id: 1, receiptId: null, paid: false }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const result = await serviceWith(prisma).createInstallmentBatch({ schoolId: 9 } as never, { rows: [{ accountId: 4, yearId: 7, amount: 10, date: '2026-01-01' }, { accountId: 4, yearId: 7, amount: 20, date: '2026-02-01' }] });
    expect(result).toHaveLength(2);
    expect(tx.installment.create).toHaveBeenCalledTimes(2);
    expect(tx.installment.create.mock.calls[0][0].data).toMatchObject({ receiptId: null, paid: false });
  });
});

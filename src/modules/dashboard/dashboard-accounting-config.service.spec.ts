import { ConflictException, NotFoundException } from '@nestjs/common';
import { DashboardAccountingConfigService } from './dashboard-accounting-config.service';

function createPrisma() {
  const tx = {
    accountingRegistrationPackageItem: { deleteMany: jest.fn() },
    accountingRegistrationPackageClass: { deleteMany: jest.fn() },
    accountingRegistrationPackage: { delete: jest.fn() },
  };
  return {
    tx,
    prisma: {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
      itemType: { findMany: jest.fn(), findUnique: jest.fn() },
      item: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      accountingInvoiceDetail: { count: jest.fn() },
      accountingRegistrationPackageItem: {
        count: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      accountingRegistrationPackageClass: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
      },
      accountingRegistrationPackage: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      currency: { findMany: jest.fn(), findUnique: jest.fn() },
      year: { findFirst: jest.fn() },
      class: { findMany: jest.fn() },
    },
  };
}

describe('DashboardAccountingConfigService', () => {
  it('rejects cross-school item reads', async () => {
    const { prisma } = createPrisma();
    prisma.item.findFirst.mockResolvedValue(null);
    const service = new DashboardAccountingConfigService(prisma as never);

    await expect(
      service.getItem({ schoolId: 3 } as never, 90),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 90, schoolId: 3 } }),
    );
  });

  it('protects an item referenced by financial history', async () => {
    const { prisma } = createPrisma();
    prisma.item.findFirst.mockResolvedValue({ id: 4 });
    prisma.accountingInvoiceDetail.count.mockResolvedValue(1);
    prisma.accountingRegistrationPackageItem.count.mockResolvedValue(0);
    const service = new DashboardAccountingConfigService(prisma as never);

    await expect(
      service.deleteItem({ schoolId: 3 } as never, 4),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.item.delete).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced item after its school scope is verified', async () => {
    const { prisma } = createPrisma();
    prisma.item.findFirst.mockResolvedValue({ id: 4 });
    prisma.accountingInvoiceDetail.count.mockResolvedValue(0);
    prisma.accountingRegistrationPackageItem.count.mockResolvedValue(0);
    const service = new DashboardAccountingConfigService(prisma as never);

    await expect(
      service.deleteItem({ schoolId: 3 } as never, 4),
    ).resolves.toEqual({
      deleted: true,
    });
    expect(prisma.item.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });

  it('rejects a duplicate package item', async () => {
    const { prisma } = createPrisma();
    prisma.accountingRegistrationPackage.findFirst.mockResolvedValue({
      id: 8,
      items: [],
      classes: [],
    });
    prisma.currency.findMany.mockResolvedValue([]);
    prisma.item.findFirst.mockResolvedValue({ id: 4 });
    prisma.currency.findUnique.mockResolvedValue({ id: 1 });
    prisma.accountingRegistrationPackageItem.findFirst.mockResolvedValue({
      id: 7,
    });
    const service = new DashboardAccountingConfigService(prisma as never);

    await expect(
      service.addPackageItem({ schoolId: 3 } as never, 8, {
        itemId: 4,
        price: 100,
        mandatory: true,
        currencyId: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects assigning a class from another school', async () => {
    const { prisma } = createPrisma();
    prisma.accountingRegistrationPackage.findFirst.mockResolvedValue({
      id: 8,
      items: [],
      classes: [],
    });
    prisma.currency.findMany.mockResolvedValue([]);
    prisma.class.findMany.mockResolvedValue([{ id: 3 }]);
    const service = new DashboardAccountingConfigService(prisma as never);

    await expect(
      service.assignPackageClasses({ schoolId: 3 } as never, 8, {
        classIds: [3, 99],
      }),
    ).rejects.toThrow('One or more classes do not belong to this school');
  });
});

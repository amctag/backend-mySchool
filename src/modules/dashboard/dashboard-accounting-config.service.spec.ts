import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DashboardAccountingConfigService } from './dashboard-accounting-config.service';

function createPrisma() {
  const tx = {
    year: { findFirst: jest.fn() },
    item: { count: jest.fn() },
    currency: { count: jest.fn() },
    class: { count: jest.fn() },
    accountingRegistrationPackageItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    accountingRegistrationPackageClass: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    accountingRegistrationPackage: {
      delete: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
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
  it('stores item prices as decimals on create and edit', async () => {
    const { prisma } = createPrisma();
    prisma.itemType.findUnique.mockResolvedValue({ id: 2 });
    prisma.item.findFirst.mockResolvedValue({ id: 4 });
    const service = new DashboardAccountingConfigService(prisma as never);

    await service.createItem({ schoolId: 3 } as never, {
      name: 'Registration',
      itemTypeId: 2,
      price: 100.25,
    });
    await service.updateItem({ schoolId: 3 } as never, 4, {
      name: 'Registration',
      itemTypeId: 2,
      price: 80.5,
    });

    expect(prisma.item.create.mock.calls[0][0].data.price).toEqual(
      new Prisma.Decimal('100.25'),
    );
    expect(prisma.item.update.mock.calls[0][0].data.price).toEqual(
      new Prisma.Decimal('80.5'),
    );
  });

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

  it('scopes available package classes to the authenticated school and selected year', async () => {
    const { prisma } = createPrisma();
    prisma.year.findFirst.mockResolvedValue({ id: 5 });
    prisma.class.findMany.mockResolvedValue([{ id: 10 }]);
    const service = new DashboardAccountingConfigService(prisma as never);

    await expect(
      service.listAvailableClasses({ schoolId: 3 } as never, 5),
    ).resolves.toEqual([{ id: 10 }]);
    expect(prisma.class.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          stage: { schoolId: 3 },
          sections: { some: { schoolId: 3, yearId: 5, status: 1 } },
        },
      }),
    );
  });

  it('creates a complete package with two items and three classes in one transaction', async () => {
    const { prisma, tx } = createPrisma();
    tx.year.findFirst.mockResolvedValue({ id: 5 });
    tx.item.count.mockResolvedValue(2);
    tx.currency.count.mockResolvedValue(1);
    tx.class.count.mockResolvedValue(3);
    tx.accountingRegistrationPackage.create.mockResolvedValue({ id: 8 });
    prisma.accountingRegistrationPackage.findFirst.mockResolvedValue({
      id: 8,
      items: [],
      classes: [],
    });
    const service = new DashboardAccountingConfigService(prisma as never);

    await service.createCompletePackage({ schoolId: 3 } as never, {
      name: 'Package A',
      yearId: 5,
      items: [
        { itemId: 1, price: 80, mandatory: true, currencyId: 1 },
        { itemId: 2, price: 45, mandatory: false, currencyId: 1 },
      ],
      classIds: [10, 11, 12],
    });

    expect(
      tx.accountingRegistrationPackageItem.createMany,
    ).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ itemId: 1 }),
        expect.objectContaining({ itemId: 2 }),
      ]),
    });
    expect(
      tx.accountingRegistrationPackageClass.createMany,
    ).toHaveBeenCalledWith({
      data: [
        { accountingRegistrationPackageId: 8, classId: 10 },
        { accountingRegistrationPackageId: 8, classId: 11 },
        { accountingRegistrationPackageId: 8, classId: 12 },
      ],
    });
  });

  it('does not create a package when a class fails school/year validation', async () => {
    const { prisma, tx } = createPrisma();
    tx.year.findFirst.mockResolvedValue({ id: 5 });
    tx.item.count.mockResolvedValue(1);
    tx.currency.count.mockResolvedValue(1);
    tx.class.count.mockResolvedValue(0);
    const service = new DashboardAccountingConfigService(prisma as never);

    await expect(
      service.createCompletePackage({ schoolId: 3 } as never, {
        name: 'Package A',
        yearId: 5,
        items: [{ itemId: 1, price: 80, mandatory: true, currencyId: 1 }],
        classIds: [99],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accountingRegistrationPackage.create).not.toHaveBeenCalled();
  });
});

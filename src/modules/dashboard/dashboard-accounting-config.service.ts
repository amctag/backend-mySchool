import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  AssignDashboardPackageClassesDto,
  DashboardItemsQueryDto,
  DashboardPackagesQueryDto,
  SaveDashboardItemDto,
  SaveCompleteDashboardPackageDto,
  SaveDashboardPackageItemDto,
} from './dto/dashboard-accounting-config.dto';

@Injectable()
export class DashboardAccountingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  listItemTypes() {
    return this.prisma.itemType.findMany({ orderBy: { name: 'asc' } });
  }

  async listItems(user: AuthenticatedSchool, query: DashboardItemsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ItemWhereInput = {
      schoolId: user.schoolId,
      itemTypeId: query.itemTypeId,
      name: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.item.count({ where }),
      this.prisma.item.findMany({
        where,
        include: { itemType: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async getItem(user: AuthenticatedSchool, id: number) {
    const item = await this.prisma.item.findFirst({
      where: { id, schoolId: user.schoolId },
      include: { itemType: true },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async createItem(user: AuthenticatedSchool, dto: SaveDashboardItemDto) {
    await this.requireItemType(dto.itemTypeId);
    return this.prisma.item.create({
      data: {
        ...dto,
        price: new Prisma.Decimal(dto.price),
        schoolId: user.schoolId,
      },
      include: { itemType: true },
    });
  }

  async updateItem(
    user: AuthenticatedSchool,
    id: number,
    dto: SaveDashboardItemDto,
  ) {
    await Promise.all([
      this.getItem(user, id),
      this.requireItemType(dto.itemTypeId),
    ]);
    return this.prisma.item.update({
      where: { id },
      data: { ...dto, price: new Prisma.Decimal(dto.price) },
      include: { itemType: true },
    });
  }

  async deleteItem(user: AuthenticatedSchool, id: number) {
    await this.getItem(user, id);
    const [invoiceCount, packageCount] = await Promise.all([
      this.prisma.accountingInvoiceDetail.count({ where: { itemId: id } }),
      this.prisma.accountingRegistrationPackageItem.count({
        where: { itemId: id },
      }),
    ]);
    if (invoiceCount + packageCount > 0) {
      throw new ConflictException(
        'Item is already used and cannot be deleted.',
      );
    }
    await this.prisma.item.delete({ where: { id } });
    return { deleted: true };
  }

  async listPackages(
    user: AuthenticatedSchool,
    query: DashboardPackagesQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.AccountingRegistrationPackageWhereInput = {
      year: { schoolId: user.schoolId },
      yearId: query.yearId,
      name: query.search
        ? { contains: query.search, mode: 'insensitive' }
        : undefined,
    };
    const [total, packages] = await this.prisma.$transaction([
      this.prisma.accountingRegistrationPackage.count({ where }),
      this.prisma.accountingRegistrationPackage.findMany({
        where,
        include: {
          year: true,
          _count: { select: { items: true, classes: true } },
        },
        orderBy: [{ dateCreated: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: packages,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPackage(user: AuthenticatedSchool, id: number) {
    const registrationPackage =
      await this.prisma.accountingRegistrationPackage.findFirst({
        where: { id, year: { schoolId: user.schoolId } },
        include: {
          year: true,
          items: {
            include: {
              item: { include: { itemType: true } },
              currency: true,
            },
          },
          classes: { include: { class: { include: { stage: true } } } },
          _count: { select: { items: true, classes: true } },
        },
      });
    if (!registrationPackage)
      throw new NotFoundException('Registration package not found');
    return registrationPackage;
  }

  async listAvailableClasses(user: AuthenticatedSchool, yearId: number) {
    await this.requireYear(user.schoolId, yearId);
    return this.prisma.class.findMany({
      where: {
        stage: { schoolId: user.schoolId },
        sections: { some: { schoolId: user.schoolId, yearId, status: 1 } },
      },
      select: {
        id: true,
        className: true,
        classLevel: true,
        position: true,
        stageId: true,
        stage: { select: { title: true, position: true } },
      },
      orderBy: [
        { stage: { position: 'asc' } },
        { position: 'asc' },
        { className: 'asc' },
      ],
    });
  }

  async createCompletePackage(
    user: AuthenticatedSchool,
    dto: SaveCompleteDashboardPackageDto,
  ) {
    const id = await this.prisma.$transaction(async (tx) => {
      await this.validateCompletePackage(tx, user.schoolId, dto);
      const created = await tx.accountingRegistrationPackage.create({
        data: { name: dto.name, yearId: dto.yearId },
        select: { id: true },
      });
      await this.replacePackageRelations(tx, created.id, dto);
      return created.id;
    });
    return this.getPackage(user, id);
  }

  async updateCompletePackage(
    user: AuthenticatedSchool,
    id: number,
    dto: SaveCompleteDashboardPackageDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.accountingRegistrationPackage.findFirst({
        where: { id, year: { schoolId: user.schoolId } },
        select: { id: true },
      });
      if (!existing)
        throw new NotFoundException('Registration package not found');
      await this.validateCompletePackage(tx, user.schoolId, dto);
      await tx.accountingRegistrationPackage.update({
        where: { id },
        data: { name: dto.name, yearId: dto.yearId },
      });
      await tx.accountingRegistrationPackageItem.deleteMany({
        where: { accountingRegistrationPackageId: id },
      });
      await tx.accountingRegistrationPackageClass.deleteMany({
        where: { accountingRegistrationPackageId: id },
      });
      await this.replacePackageRelations(tx, id, dto);
    });
    return this.getPackage(user, id);
  }

  async deletePackage(user: AuthenticatedSchool, id: number) {
    await this.getPackage(user, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.accountingRegistrationPackageItem.deleteMany({
        where: { accountingRegistrationPackageId: id },
      });
      await tx.accountingRegistrationPackageClass.deleteMany({
        where: { accountingRegistrationPackageId: id },
      });
      await tx.accountingRegistrationPackage.delete({ where: { id } });
    });
    return { deleted: true };
  }

  async addPackageItem(
    user: AuthenticatedSchool,
    packageId: number,
    dto: SaveDashboardPackageItemDto,
  ) {
    await Promise.all([
      this.getPackage(user, packageId),
      this.getItem(user, dto.itemId),
      this.requireCurrency(dto.currencyId),
    ]);
    const duplicate =
      await this.prisma.accountingRegistrationPackageItem.findFirst({
        where: {
          accountingRegistrationPackageId: packageId,
          itemId: dto.itemId,
        },
      });
    if (duplicate)
      throw new ConflictException('Item is already in this package');
    try {
      return await this.prisma.accountingRegistrationPackageItem.create({
        data: { ...dto, accountingRegistrationPackageId: packageId },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Item is already in this package');
      }
      throw error;
    }
  }

  async removePackageItem(
    user: AuthenticatedSchool,
    packageId: number,
    relationId: number,
  ) {
    await this.getPackage(user, packageId);
    const relation =
      await this.prisma.accountingRegistrationPackageItem.findFirst({
        where: { id: relationId, accountingRegistrationPackageId: packageId },
      });
    if (!relation) throw new NotFoundException('Package item not found');
    await this.prisma.accountingRegistrationPackageItem.delete({
      where: { id: relationId },
    });
    return { deleted: true };
  }

  async assignPackageClasses(
    user: AuthenticatedSchool,
    packageId: number,
    dto: AssignDashboardPackageClassesDto,
  ) {
    await this.getPackage(user, packageId);
    const classIds = [...new Set(dto.classIds)];
    if (classIds.length !== dto.classIds.length) {
      throw new BadRequestException('Duplicate class selection');
    }
    const classes = await this.prisma.class.findMany({
      where: { id: { in: classIds }, stage: { schoolId: user.schoolId } },
      select: { id: true },
    });
    if (classes.length !== classIds.length) {
      throw new BadRequestException(
        'One or more classes do not belong to this school',
      );
    }
    const existing =
      await this.prisma.accountingRegistrationPackageClass.findMany({
        where: {
          accountingRegistrationPackageId: packageId,
          classId: { in: classIds },
        },
        select: { classId: true },
      });
    if (existing.length)
      throw new ConflictException('Class is already assigned to this package');
    try {
      await this.prisma.accountingRegistrationPackageClass.createMany({
        data: classIds.map((classId) => ({
          accountingRegistrationPackageId: packageId,
          classId,
        })),
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Class is already assigned to this package',
        );
      }
      throw error;
    }
    return this.getPackage(user, packageId);
  }

  async removePackageClass(
    user: AuthenticatedSchool,
    packageId: number,
    relationId: number,
  ) {
    await this.getPackage(user, packageId);
    const relation =
      await this.prisma.accountingRegistrationPackageClass.findFirst({
        where: { id: relationId, accountingRegistrationPackageId: packageId },
      });
    if (!relation) throw new NotFoundException('Package class not found');
    await this.prisma.accountingRegistrationPackageClass.delete({
      where: { id: relationId },
    });
    return { deleted: true };
  }

  private async requireItemType(id: number) {
    if (!(await this.prisma.itemType.findUnique({ where: { id } }))) {
      throw new BadRequestException('Invalid item type');
    }
  }

  private async requireCurrency(id: number) {
    if (!(await this.prisma.currency.findUnique({ where: { id } }))) {
      throw new BadRequestException('Invalid currency');
    }
  }

  private async requireYear(schoolId: number, id: number) {
    if (!(await this.prisma.year.findFirst({ where: { id, schoolId } }))) {
      throw new BadRequestException(
        'School year does not belong to this school',
      );
    }
  }

  private async validateCompletePackage(
    tx: Prisma.TransactionClient,
    schoolId: number,
    dto: SaveCompleteDashboardPackageDto,
  ) {
    const itemIds = dto.items.map((item) => item.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException('Duplicate package item selection');
    }
    const currencyIds = [...new Set(dto.items.map((item) => item.currencyId))];
    const [year, itemCount, currencyCount, classCount] = await Promise.all([
      tx.year.findFirst({
        where: { id: dto.yearId, schoolId },
        select: { id: true },
      }),
      tx.item.count({ where: { id: { in: itemIds }, schoolId } }),
      tx.currency.count({ where: { id: { in: currencyIds } } }),
      tx.class.count({
        where: {
          id: { in: dto.classIds },
          stage: { schoolId },
          sections: { some: { schoolId, yearId: dto.yearId, status: 1 } },
        },
      }),
    ]);
    if (!year)
      throw new BadRequestException(
        'School year does not belong to this school',
      );
    if (itemCount !== itemIds.length)
      throw new BadRequestException(
        'One or more items do not belong to this school',
      );
    if (currencyCount !== currencyIds.length)
      throw new BadRequestException('Invalid currency');
    if (classCount !== dto.classIds.length)
      throw new BadRequestException(
        'One or more classes are not available for this school year',
      );
  }

  private async replacePackageRelations(
    tx: Prisma.TransactionClient,
    packageId: number,
    dto: SaveCompleteDashboardPackageDto,
  ) {
    await tx.accountingRegistrationPackageItem.createMany({
      data: dto.items.map((item) => ({
        accountingRegistrationPackageId: packageId,
        itemId: item.itemId,
        price: new Prisma.Decimal(item.price),
        mandatory: item.mandatory,
        currencyId: item.currencyId,
      })),
    });
    await tx.accountingRegistrationPackageClass.createMany({
      data: dto.classIds.map((classId) => ({
        accountingRegistrationPackageId: packageId,
        classId,
      })),
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardParentDto } from './dto/create-dashboard-parent.dto';
import { DashboardParentDetailDto } from './dto/dashboard-parent-detail.dto';
import { DashboardParentsQueryDto } from './dto/dashboard-parents-query.dto';
import {
  DashboardParentOptionDto,
  DashboardParentsResponseDto,
} from './dto/dashboard-parents-response.dto';
import { UpdateDashboardParentDto } from './dto/update-dashboard-parent.dto';
import {
  assertUniquePersonContacts,
  emptyToNull,
  normalizeEmail,
  rethrowPersonWriteError,
} from './person-contact-uniqueness';
import { purgeStudentAndPerson } from './purge-student';

const DEFAULT_PARENT_PASSWORD = 'password123';

const parentDetailInclude = { person: true } as const;

type ParentDetailRecord = {
  id: number;
  personId: number;
  currentJobId: number | null;
  description: string | null;
  person: {
    firstName: string;
    middleName: string;
    lastName: string;
    gender: number | null;
    nationalityId: number | null;
    governorateId: number | null;
    registerId: number | null;
    regionId: number | null;
    identityNumber: string | null;
    email: string | null;
    phoneNumber: string | null;
    urgentNumber: string | null;
    landline: string | null;
    address: string | null;
    village: string | null;
    placeOfBirth: string | null;
    birthday: Date | null;
  };
};

@Injectable()
export class DashboardParentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listParents(
    user: AuthenticatedSchool,
    query: DashboardParentsQueryDto,
  ): Promise<DashboardParentsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const schoolId = user.schoolId;
    const where = this.buildWhere(schoolId, query);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, parents] = await this.prisma.$transaction([
      this.prisma.parent.count({ where }),
      this.prisma.parent.findMany({
        where,
        include: {
          person: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              picture: true,
              address: true,
              phoneNumber: true,
            },
          },
          _count: {
            select: {
              students: {
                where: { person: { schoolId } },
              },
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: parents.map((parent) => ({
        id: parent.id,
        fullName: this.formatFullName(parent.person),
        firstName: parent.person.firstName,
        lastName: parent.person.lastName,
        picture: parent.person.picture,
        address: parent.person.address,
        phoneNumber: parent.person.phoneNumber,
        childrenCount: parent._count.students,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listParentOptions(
    user: AuthenticatedSchool,
    search?: string,
  ): Promise<DashboardParentOptionDto[]> {
    const term = search?.trim();
    if (!term) {
      return [];
    }

    const schoolId = user.schoolId;
    const nameMatch = this.nameContainsFilter(term);
    const parents = await this.prisma.parent.findMany({
      where: {
        AND: [
          {
            OR: [
              { person: { schoolId } },
              { students: { some: { person: { schoolId } } } },
            ],
          },
          nameMatch ? { person: nameMatch } : {},
        ],
      },
      include: {
        person: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { person: { firstName: 'asc' } },
        { person: { lastName: 'asc' } },
      ],
      take: 25,
    });

    return parents.map((parent) => ({
      id: parent.id,
      fullName: this.formatFullName(parent.person),
      firstName: parent.person.firstName,
      middleName: parent.person.middleName,
      lastName: parent.person.lastName,
    }));
  }

  async getParent(
    user: AuthenticatedSchool,
    parentId: number,
  ): Promise<DashboardParentDetailDto> {
    const parent = await this.findVisibleParent(user.schoolId, parentId);

    return this.toDetail(parent);
  }

  async createParent(
    user: AuthenticatedSchool,
    dto: CreateDashboardParentDto,
  ): Promise<DashboardParentDetailDto> {
    const location = await this.resolveLocation(dto.governorateId, dto.regionId);
    await this.assertLookups(dto.nationalityId, dto.currentJobId);

    const identityNumber = emptyToNull(dto.identityNumber);
    const email = normalizeEmail(dto.email);
    const phoneNumber = dto.phoneNumber.trim();
    await assertUniquePersonContacts(this.prisma, {
      identityNumber,
      email,
      phoneNumber,
    });

    const username = await this.uniqueUsername(
      user.schoolId,
      dto.firstName,
      dto.lastName,
      phoneNumber,
    );
    const password = await bcrypt.hash(DEFAULT_PARENT_PASSWORD, 10);

    try {
      const parent = await this.prisma.$transaction(async (tx) => {
        const person = await tx.person.create({
          data: {
            schoolId: user.schoolId,
            username,
            password,
            firstName: dto.firstName,
            middleName: dto.middleName ?? '',
            lastName: dto.lastName,
            gender: dto.gender ?? null,
            nationalityId: dto.nationalityId ?? null,
            governorateId: location.governorateId,
            registerId: dto.registerId ?? null,
            regionId: location.regionId,
            identityNumber,
            email,
            phoneNumber,
            urgentNumber: dto.urgentNumber ?? null,
            landline: dto.landline ?? null,
            address: dto.address ?? null,
            village: dto.village ?? null,
            placeOfBirth: dto.placeOfBirth ?? null,
            birthday: this.parseDate(dto.birthday),
          },
        });

        return tx.parent.create({
          data: {
            personId: person.id,
            currentJobId: dto.currentJobId ?? null,
            description: dto.description ?? null,
          },
          include: parentDetailInclude,
        });
      });

      return this.toDetail(parent as unknown as ParentDetailRecord);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async updateParent(
    user: AuthenticatedSchool,
    parentId: number,
    dto: UpdateDashboardParentDto,
  ): Promise<DashboardParentDetailDto> {
    const existing = await this.findVisibleParent(user.schoolId, parentId);
    const location = await this.resolveLocation(
      dto.governorateId !== undefined
        ? dto.governorateId
        : existing.person.governorateId ?? undefined,
      dto.regionId !== undefined
        ? dto.regionId
        : existing.person.regionId ?? undefined,
    );

    if (dto.nationalityId !== undefined || dto.currentJobId !== undefined) {
      await this.assertLookups(
        dto.nationalityId !== undefined
          ? dto.nationalityId
          : existing.person.nationalityId ?? undefined,
        dto.currentJobId !== undefined
          ? dto.currentJobId
          : existing.currentJobId ?? undefined,
      );
    }

    const identityNumber =
      dto.identityNumber !== undefined
        ? emptyToNull(dto.identityNumber)
        : existing.person.identityNumber;
    const email =
      dto.email !== undefined
        ? normalizeEmail(dto.email)
        : existing.person.email;
    const phoneNumber = dto.phoneNumber
      ? dto.phoneNumber.trim()
      : existing.person.phoneNumber;
    await assertUniquePersonContacts(
      this.prisma,
      { identityNumber, email, phoneNumber },
      existing.personId,
    );

    try {
      const parent = await this.prisma.$transaction(async (tx) => {
        await tx.person.update({
          where: { id: existing.personId },
          data: {
            firstName: dto.firstName ?? existing.person.firstName,
            middleName:
              dto.middleName !== undefined
                ? (dto.middleName ?? '')
                : existing.person.middleName,
            lastName: dto.lastName ?? existing.person.lastName,
            gender:
              dto.gender !== undefined ? dto.gender : existing.person.gender,
            nationalityId:
              dto.nationalityId !== undefined
                ? dto.nationalityId
                : existing.person.nationalityId,
            governorateId: location.governorateId,
            registerId:
              dto.registerId !== undefined
                ? dto.registerId
                : existing.person.registerId,
            regionId: location.regionId,
            identityNumber,
            email,
            phoneNumber,
            urgentNumber:
              dto.urgentNumber !== undefined
                ? dto.urgentNumber
                : existing.person.urgentNumber,
            landline:
              dto.landline !== undefined
                ? dto.landline
                : existing.person.landline,
            address:
              dto.address !== undefined
                ? dto.address
                : existing.person.address,
            village:
              dto.village !== undefined
                ? dto.village
                : existing.person.village,
            placeOfBirth:
              dto.placeOfBirth !== undefined
                ? dto.placeOfBirth
                : existing.person.placeOfBirth,
            birthday:
              dto.birthday !== undefined
                ? this.parseDate(dto.birthday)
                : existing.person.birthday,
          },
        });

        return tx.parent.update({
          where: { id: parentId },
          data: {
            currentJobId:
              dto.currentJobId !== undefined
                ? dto.currentJobId
                : existing.currentJobId,
            description:
              dto.description !== undefined
                ? dto.description
                : existing.description,
          },
          include: parentDetailInclude,
        });
      });

      return this.toDetail(parent as unknown as ParentDetailRecord);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async deleteParent(
    user: AuthenticatedSchool,
    parentId: number,
  ): Promise<void> {
    const parent = await this.findVisibleParent(user.schoolId, parentId);
    const schoolStudents = await this.prisma.student.findMany({
      where: {
        parentId,
        person: { schoolId: user.schoolId },
      },
      select: { id: true, personId: true },
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const student of schoolStudents) {
          await purgeStudentAndPerson(tx, student);
        }

        const remainingChildren = await tx.student.count({
          where: { parentId },
        });
        if (remainingChildren > 0) {
          return;
        }

        await tx.parent.delete({ where: { id: parentId } });
        try {
          await tx.person.delete({ where: { id: parent.personId } });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2003'
          ) {
            throw new ConflictException(
              'This parent is still linked to other school records and cannot be deleted',
            );
          }

          throw error;
        }
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private async findVisibleParent(
    schoolId: number,
    parentId: number,
  ): Promise<ParentDetailRecord> {
    const parent = await this.prisma.parent.findFirst({
      where: {
        id: parentId,
        OR: [
          { person: { schoolId } },
          { students: { some: { person: { schoolId } } } },
        ],
      },
      include: parentDetailInclude,
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    return parent as unknown as ParentDetailRecord;
  }

  private toDetail(parent: ParentDetailRecord): DashboardParentDetailDto {
    return {
      id: parent.id,
      firstName: parent.person.firstName,
      middleName: parent.person.middleName,
      lastName: parent.person.lastName,
      gender: parent.person.gender,
      nationalityId: parent.person.nationalityId,
      governorateId: parent.person.governorateId,
      registerId: parent.person.registerId,
      regionId: parent.person.regionId,
      currentJobId: parent.currentJobId,
      identityNumber: parent.person.identityNumber,
      email: parent.person.email,
      phoneNumber: parent.person.phoneNumber,
      urgentNumber: parent.person.urgentNumber,
      landline: parent.person.landline,
      address: parent.person.address,
      village: parent.person.village,
      placeOfBirth: parent.person.placeOfBirth,
      description: parent.description,
      birthday: parent.person.birthday
        ? parent.person.birthday.toISOString().slice(0, 10)
        : null,
    };
  }

  private async resolveLocation(
    governorateId?: number,
    regionId?: number,
  ): Promise<{ governorateId: number | null; regionId: number | null }> {
    if (!regionId && !governorateId) {
      return { governorateId: null, regionId: null };
    }

    if (regionId) {
      const region = await this.prisma.region.findUnique({
        where: { id: regionId },
        select: { id: true, governorateId: true },
      });

      if (!region) {
        throw new BadRequestException('Region not found');
      }

      if (governorateId && governorateId !== region.governorateId) {
        throw new BadRequestException(
          'Region does not belong to the selected governorate',
        );
      }

      return {
        governorateId: region.governorateId,
        regionId: region.id,
      };
    }

    const governorate = await this.prisma.governorate.findUnique({
      where: { id: governorateId },
      select: { id: true },
    });

    if (!governorate) {
      throw new BadRequestException('Governorate not found');
    }

    return { governorateId: governorate.id, regionId: null };
  }

  private async assertLookups(
    nationalityId?: number,
    currentJobId?: number,
  ): Promise<void> {
    if (nationalityId) {
      const nationality = await this.prisma.nationality.findUnique({
        where: { id: nationalityId },
        select: { id: true },
      });
      if (!nationality) {
        throw new BadRequestException('Nationality not found');
      }
    }

    if (currentJobId) {
      const job = await this.prisma.parentJob.findUnique({
        where: { id: currentJobId },
        select: { id: true },
      });
      if (!job) {
        throw new BadRequestException('Job not found');
      }
    }
  }

  private async uniqueUsername(
    schoolId: number,
    firstName: string,
    lastName: string,
    phoneNumber: string,
  ): Promise<string> {
    const slug = `${firstName}.${lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '')
      .replace(/^\.+|\.+$/g, '');
    const digits = phoneNumber.replace(/\D/g, '').slice(-6);
    let username = (slug || 'parent') + (digits ? `.${digits}` : '');

    if (username.length > 90) {
      username = username.slice(0, 90);
    }

    const clash = await this.prisma.person.findFirst({
      where: { schoolId, username },
      select: { id: true },
    });

    if (!clash) {
      return username;
    }

    return `${username}.${Date.now().toString().slice(-6)}`.slice(0, 100);
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Birthday must be YYYY-MM-DD');
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid birthday');
    }

    return date;
  }

  private rethrowWriteError(error: unknown): never {
    rethrowPersonWriteError(
      error,
      'A parent with this username already exists',
    );
  }

  private buildOrderBy(
    sortBy?: DashboardParentsQueryDto['sortBy'],
    sortOrder?: DashboardParentsQueryDto['sortOrder'],
  ): Prisma.ParentOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.ParentOrderByWithRelationInput = {
      id: direction,
    };

    if (sortBy === 'name') {
      return [
        { person: { firstName: direction } },
        { person: { lastName: direction } },
        idTieBreaker,
      ];
    }

    if (sortBy === 'address') {
      return [{ person: { address: direction } }, idTieBreaker];
    }

    if (sortBy === 'phone') {
      return [{ person: { phoneNumber: direction } }, idTieBreaker];
    }

    if (sortBy === 'childrenCount') {
      return [{ students: { _count: direction } }, idTieBreaker];
    }

    return [{ id: direction }];
  }

  private buildWhere(
    schoolId: number,
    query: DashboardParentsQueryDto,
  ): Prisma.ParentWhereInput {
    const nameContains = this.nameContainsFilter(query.name);
    const searchContains = this.searchFilter(query.search);

    return {
      AND: [
        {
          OR: [
            { person: { schoolId } },
            { students: { some: { person: { schoolId } } } },
          ],
        },
        query.id ? { id: query.id } : {},
        nameContains ? { person: nameContains } : {},
        searchContains,
      ],
    };
  }

  private nameContainsFilter(
    name?: string,
  ): Prisma.PersonWhereInput | undefined {
    if (!name) {
      return undefined;
    }

    return {
      OR: [
        { firstName: { contains: name, mode: 'insensitive' } },
        { middleName: { contains: name, mode: 'insensitive' } },
        { lastName: { contains: name, mode: 'insensitive' } },
      ],
    };
  }

  private searchFilter(search?: string): Prisma.ParentWhereInput {
    if (!search) {
      return {};
    }

    const nameMatch = this.nameContainsFilter(search);
    const parsedId = /^\d+$/.test(search) ? Number(search) : undefined;

    return {
      OR: [
        ...(parsedId ? [{ id: parsedId }] : []),
        ...(nameMatch ? [{ person: nameMatch }] : []),
      ],
    };
  }

  private formatFullName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .filter(Boolean)
      .join(' ');
  }
}

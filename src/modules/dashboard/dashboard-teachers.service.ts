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
import { CreateDashboardTeacherDto } from './dto/create-dashboard-teacher.dto';
import { DashboardTeacherDetailDto } from './dto/dashboard-teacher-detail.dto';
import { DashboardTeachersQueryDto } from './dto/dashboard-teachers-query.dto';
import { DashboardTeachersResponseDto } from './dto/dashboard-teachers-response.dto';
import { UpdateDashboardTeacherDto } from './dto/update-dashboard-teacher.dto';
import {
  assertUniquePersonContacts,
  emptyToNull,
  normalizeEmail,
  rethrowPersonWriteError,
} from './person-contact-uniqueness';

const DEFAULT_TEACHER_PASSWORD = 'password123';

const teacherDetailInclude = { person: true } as const;

type TeacherDetailRecord = {
  id: number;
  personId: number;
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
export class DashboardTeachersService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeachers(
    user: AuthenticatedSchool,
    query: DashboardTeachersQueryDto,
  ): Promise<DashboardTeachersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const schoolId = user.schoolId;
    const where = this.buildWhere(schoolId, query);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, teachers] = await this.prisma.$transaction([
      this.prisma.teacher.count({ where }),
      this.prisma.teacher.findMany({
        where,
        include: {
          person: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              address: true,
              phoneNumber: true,
              birthday: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: teachers.map((teacher) => ({
        id: teacher.id,
        fullName: this.formatFullName(teacher.person),
        firstName: teacher.person.firstName,
        lastName: teacher.person.lastName,
        phoneNumber: teacher.person.phoneNumber,
        address: teacher.person.address,
        birthday: this.formatDate(teacher.person.birthday),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getTeacher(
    user: AuthenticatedSchool,
    teacherId: number,
  ): Promise<DashboardTeacherDetailDto> {
    const teacher = await this.findVisibleTeacher(user.schoolId, teacherId);
    return this.toDetail(teacher);
  }

  async createTeacher(
    user: AuthenticatedSchool,
    dto: CreateDashboardTeacherDto,
  ): Promise<DashboardTeacherDetailDto> {
    const location = await this.resolveLocation(dto.governorateId, dto.regionId);
    await this.assertNationality(dto.nationalityId);

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
    const password = await bcrypt.hash(DEFAULT_TEACHER_PASSWORD, 10);

    try {
      const teacher = await this.prisma.$transaction(async (tx) => {
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

        const created = await tx.teacher.create({
          data: { personId: person.id },
          include: teacherDetailInclude,
        });

        await tx.teacherSchool.create({
          data: {
            teacherId: created.id,
            schoolId: user.schoolId,
            isActive: true,
          },
        });

        return created;
      });

      return this.toDetail(teacher as unknown as TeacherDetailRecord);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async updateTeacher(
    user: AuthenticatedSchool,
    teacherId: number,
    dto: UpdateDashboardTeacherDto,
  ): Promise<DashboardTeacherDetailDto> {
    const existing = await this.findVisibleTeacher(user.schoolId, teacherId);
    const location = await this.resolveLocation(
      dto.governorateId !== undefined
        ? dto.governorateId
        : existing.person.governorateId ?? undefined,
      dto.regionId !== undefined
        ? dto.regionId
        : existing.person.regionId ?? undefined,
    );

    if (dto.nationalityId !== undefined) {
      await this.assertNationality(dto.nationalityId);
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
      const teacher = await this.prisma.$transaction(async (tx) => {
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

        return tx.teacher.findUniqueOrThrow({
          where: { id: teacherId },
          include: teacherDetailInclude,
        });
      });

      return this.toDetail(teacher as unknown as TeacherDetailRecord);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async deleteTeacher(
    user: AuthenticatedSchool,
    teacherId: number,
  ): Promise<void> {
    const teacher = await this.findVisibleTeacher(user.schoolId, teacherId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.teach.deleteMany({ where: { teacherId } });
        await tx.teacherSchool.deleteMany({
          where: { teacherId, schoolId: user.schoolId },
        });

        const remainingSchools = await tx.teacherSchool.count({
          where: { teacherId },
        });
        if (remainingSchools > 0) {
          return;
        }

        await tx.weeklyScheduleDetail.updateMany({
          where: { personId: teacher.personId },
          data: { personId: null },
        });

        await tx.teacher.delete({ where: { id: teacherId } });
        try {
          await tx.person.delete({ where: { id: teacher.personId } });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2003'
          ) {
            throw new ConflictException(
              'This teacher is still linked to other school records and cannot be deleted',
            );
          }

          throw error;
        }
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private async findVisibleTeacher(
    schoolId: number,
    teacherId: number,
  ): Promise<TeacherDetailRecord> {
    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: teacherId,
        schools: { some: { schoolId, isActive: true } },
      },
      include: teacherDetailInclude,
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    return teacher as unknown as TeacherDetailRecord;
  }

  private toDetail(teacher: TeacherDetailRecord): DashboardTeacherDetailDto {
    return {
      id: teacher.id,
      firstName: teacher.person.firstName,
      middleName: teacher.person.middleName,
      lastName: teacher.person.lastName,
      gender: teacher.person.gender,
      nationalityId: teacher.person.nationalityId,
      governorateId: teacher.person.governorateId,
      registerId: teacher.person.registerId,
      regionId: teacher.person.regionId,
      identityNumber: teacher.person.identityNumber,
      email: teacher.person.email,
      phoneNumber: teacher.person.phoneNumber,
      urgentNumber: teacher.person.urgentNumber,
      landline: teacher.person.landline,
      address: teacher.person.address,
      village: teacher.person.village,
      placeOfBirth: teacher.person.placeOfBirth,
      birthday: this.formatDate(teacher.person.birthday),
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

  private async assertNationality(nationalityId?: number): Promise<void> {
    if (!nationalityId) {
      return;
    }

    const nationality = await this.prisma.nationality.findUnique({
      where: { id: nationalityId },
      select: { id: true },
    });
    if (!nationality) {
      throw new BadRequestException('Nationality not found');
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
    let username = (slug || 'teacher') + (digits ? `.${digits}` : '');

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

  private formatDate(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private rethrowWriteError(error: unknown): never {
    rethrowPersonWriteError(
      error,
      'A teacher with this username already exists',
    );
  }

  private buildOrderBy(
    sortBy?: DashboardTeachersQueryDto['sortBy'],
    sortOrder?: DashboardTeachersQueryDto['sortOrder'],
  ): Prisma.TeacherOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.TeacherOrderByWithRelationInput = {
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

    if (sortBy === 'birthday') {
      return [{ person: { birthday: direction } }, idTieBreaker];
    }

    return [{ id: direction }];
  }

  private buildWhere(
    schoolId: number,
    query: DashboardTeachersQueryDto,
  ): Prisma.TeacherWhereInput {
    const nameContains = this.nameContainsFilter(query.name);
    const searchContains = this.searchFilter(query.search);

    return {
      AND: [
        { schools: { some: { schoolId, isActive: true } } },
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

  private searchFilter(search?: string): Prisma.TeacherWhereInput {
    if (!search) {
      return {};
    }

    const nameMatch = this.nameContainsFilter(search);
    const parsedId = /^\d+$/.test(search) ? Number(search) : undefined;

    return {
      OR: [
        ...(parsedId ? [{ id: parsedId }] : []),
        ...(nameMatch ? [{ person: nameMatch }] : []),
        {
          person: {
            phoneNumber: { contains: search, mode: 'insensitive' },
          },
        },
        {
          person: {
            address: { contains: search, mode: 'insensitive' },
          },
        },
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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { parseInt4FilterValue } from '../../common/constants/database-limits';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardDirectorDto } from './dto/create-dashboard-director.dto';
import { DashboardDirectorDetailDto } from './dto/dashboard-director-detail.dto';
import { DashboardDirectorsQueryDto } from './dto/dashboard-directors-query.dto';
import { DashboardDirectorsResponseDto } from './dto/dashboard-directors-response.dto';
import { UpdateDashboardDirectorDto } from './dto/update-dashboard-director.dto';
import { personNameContainsFilter } from './person-name-search';
import {
  assertUniquePersonContacts,
  emptyToNull,
  normalizeEmail,
  rethrowPersonWriteError,
} from './person-contact-uniqueness';
import {
  assertNationalityExists,
  formatIsoDate,
  formatPersonFullName,
  parseIsoDate,
  resolvePersonLocation,
  uniquePersonUsername,
} from './person-profile.helpers';

/**
 * The Director Flutter app signs in with the linked persons.id and a password,
 * so dashboard-created directors receive the same default password as teachers
 * and can change it later through the reset-password action.
 */
const DEFAULT_DIRECTOR_PASSWORD = 'password123';

const directorDetailInclude = { person: true } as const;

type DirectorPersonRecord = {
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
  status: boolean;
};

type DirectorDetailRecord = {
  id: number;
  personId: number;
  createdAt: Date;
  person: DirectorPersonRecord;
};

type TenantSchool = {
  id: number;
  name: string;
};

@Injectable()
export class DashboardDirectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDirectors(
    user: AuthenticatedSchool,
    query: DashboardDirectorsQueryDto,
  ): Promise<DashboardDirectorsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const schoolId = user.schoolId;
    const school = await this.requireSchool(schoolId);
    const where = this.buildWhere(schoolId, query);
    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, directors] = await this.prisma.$transaction([
      this.prisma.director.count({ where }),
      this.prisma.director.findMany({
        where,
        include: {
          person: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              phoneNumber: true,
              email: true,
              address: true,
              birthday: true,
              status: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: directors.map((director) => ({
        id: director.id,
        personId: director.personId,
        fullName: formatPersonFullName(director.person),
        firstName: director.person.firstName,
        lastName: director.person.lastName,
        phoneNumber: director.person.phoneNumber,
        email: director.person.email,
        address: director.person.address,
        birthday: formatIsoDate(director.person.birthday),
        status: director.person.status,
        schoolId: school.id,
        schoolName: school.name,
        isActiveInSchool: true,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getDirector(
    user: AuthenticatedSchool,
    directorId: number,
  ): Promise<DashboardDirectorDetailDto> {
    const [director, school] = await Promise.all([
      this.findVisibleDirector(user.schoolId, directorId),
      this.requireSchool(user.schoolId),
    ]);

    return this.toDetail(director, school);
  }

  async createDirector(
    user: AuthenticatedSchool,
    dto: CreateDashboardDirectorDto,
  ): Promise<DashboardDirectorDetailDto> {
    const school = await this.requireSchool(user.schoolId);
    const location = await resolvePersonLocation(
      this.prisma,
      dto.governorateId,
      dto.regionId,
    );
    await assertNationalityExists(this.prisma, dto.nationalityId);

    const identityNumber = emptyToNull(dto.identityNumber);
    const email = normalizeEmail(dto.email);
    const phoneNumber = dto.phoneNumber.trim();
    await assertUniquePersonContacts(this.prisma, {
      identityNumber,
      email,
      phoneNumber,
    });

    const username = await uniquePersonUsername(
      this.prisma,
      user.schoolId,
      dto.firstName,
      dto.lastName,
      phoneNumber,
      'director',
    );
    const password = await bcrypt.hash(DEFAULT_DIRECTOR_PASSWORD, 10);

    try {
      const director = await this.prisma.$transaction(async (tx) => {
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
            birthday: parseIsoDate(dto.birthday),
          },
        });

        const created = await tx.director.create({
          data: { personId: person.id },
          include: directorDetailInclude,
        });

        // The director is always linked to the authenticated tenant only.
        await tx.directorSchool.create({
          data: {
            directorId: created.id,
            schoolId: user.schoolId,
            isActive: true,
          },
        });

        return created;
      });

      return this.toDetail(director, school);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async updateDirector(
    user: AuthenticatedSchool,
    directorId: number,
    dto: UpdateDashboardDirectorDto,
  ): Promise<DashboardDirectorDetailDto> {
    const [existing, school] = await Promise.all([
      this.findVisibleDirector(user.schoolId, directorId),
      this.requireSchool(user.schoolId),
    ]);

    const location = await resolvePersonLocation(
      this.prisma,
      dto.governorateId !== undefined
        ? dto.governorateId
        : (existing.person.governorateId ?? undefined),
      dto.regionId !== undefined
        ? dto.regionId
        : (existing.person.regionId ?? undefined),
    );

    if (dto.nationalityId !== undefined) {
      await assertNationalityExists(this.prisma, dto.nationalityId);
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
      const director = await this.prisma.$transaction(async (tx) => {
        // Update the existing persons row in place. Username, password, paid
        // and the director identity stay untouched so the Director app keeps
        // signing in with the same person id.
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
              dto.address !== undefined ? dto.address : existing.person.address,
            village:
              dto.village !== undefined ? dto.village : existing.person.village,
            placeOfBirth:
              dto.placeOfBirth !== undefined
                ? dto.placeOfBirth
                : existing.person.placeOfBirth,
            birthday:
              dto.birthday !== undefined
                ? parseIsoDate(dto.birthday)
                : existing.person.birthday,
          },
        });

        return tx.director.findUniqueOrThrow({
          where: { id: directorId },
          include: directorDetailInclude,
        });
      });

      return this.toDetail(director, school);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async updateDirectorStatus(
    user: AuthenticatedSchool,
    directorId: number,
    status: boolean,
  ): Promise<{ id: number; status: boolean }> {
    const existing = await this.findVisibleDirector(user.schoolId, directorId);
    await this.prisma.person.update({
      where: { id: existing.personId },
      data: { status },
    });
    return { id: existing.id, status };
  }

  async resetDirectorPassword(
    user: AuthenticatedSchool,
    directorId: number,
    newPassword: string,
    confirmPassword: string,
  ): Promise<{ id: number; reset: boolean }> {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Passwords do not match',
        fieldErrors: { confirmPassword: 'Passwords do not match' },
      });
    }

    const existing = await this.findVisibleDirector(user.schoolId, directorId);
    await this.prisma.person.update({
      where: { id: existing.personId },
      data: { password: await bcrypt.hash(newPassword, 10) },
    });
    return { id: existing.id, reset: true };
  }

  private async findVisibleDirector(
    schoolId: number,
    directorId: number,
  ): Promise<DirectorDetailRecord> {
    const director = await this.prisma.director.findFirst({
      where: {
        id: directorId,
        schools: { some: { schoolId, isActive: true } },
      },
      include: directorDetailInclude,
    });

    if (!director) {
      throw new NotFoundException('Director not found');
    }

    return director;
  }

  private async requireSchool(schoolId: number): Promise<TenantSchool> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, isActive: true },
    });

    if (!school || !school.isActive) {
      throw new NotFoundException('School not found');
    }

    return { id: school.id, name: school.name };
  }

  private toDetail(
    director: DirectorDetailRecord,
    school: TenantSchool,
  ): DashboardDirectorDetailDto {
    return {
      id: director.id,
      personId: director.personId,
      directorId: director.id,
      firstName: director.person.firstName,
      middleName: director.person.middleName,
      lastName: director.person.lastName,
      gender: director.person.gender,
      nationalityId: director.person.nationalityId,
      governorateId: director.person.governorateId,
      registerId: director.person.registerId,
      regionId: director.person.regionId,
      identityNumber: director.person.identityNumber,
      email: director.person.email,
      phoneNumber: director.person.phoneNumber,
      urgentNumber: director.person.urgentNumber,
      landline: director.person.landline,
      address: director.person.address,
      village: director.person.village,
      placeOfBirth: director.person.placeOfBirth,
      birthday: formatIsoDate(director.person.birthday),
      status: director.person.status,
      createdAt: formatIsoDate(director.createdAt) ?? '',
      schoolId: school.id,
      schoolName: school.name,
      isActiveInSchool: true,
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = JSON.stringify(error.meta?.target ?? '');
      if (target.includes('username')) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: 'A director with this username already exists',
        });
      }
    }

    rethrowPersonWriteError(
      error,
      'A director with this username already exists',
    );
  }

  private buildOrderBy(
    sortBy?: DashboardDirectorsQueryDto['sortBy'],
    sortOrder?: DashboardDirectorsQueryDto['sortOrder'],
  ): Prisma.DirectorOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.DirectorOrderByWithRelationInput = {
      id: direction,
    };

    if (sortBy === 'name') {
      return [
        { person: { firstName: direction } },
        { person: { lastName: direction } },
        idTieBreaker,
      ];
    }

    if (sortBy === 'phone') {
      return [{ person: { phoneNumber: direction } }, idTieBreaker];
    }

    if (sortBy === 'email') {
      return [{ person: { email: direction } }, idTieBreaker];
    }

    if (sortBy === 'address') {
      return [{ person: { address: direction } }, idTieBreaker];
    }

    if (sortBy === 'birthday') {
      return [{ person: { birthday: direction } }, idTieBreaker];
    }

    return [{ id: direction }];
  }

  private buildWhere(
    schoolId: number,
    query: DashboardDirectorsQueryDto,
  ): Prisma.DirectorWhereInput {
    const nameContains = personNameContainsFilter(query.name);
    const searchContains = this.searchFilter(query.search);
    const firstName = query.firstName?.trim();
    const middleName = query.middleName?.trim();
    const lastName = query.lastName?.trim();

    return {
      AND: [
        { schools: { some: { schoolId, isActive: true } } },
        query.id ? { id: query.id } : {},
        query.status === 'active' ? { person: { status: true } } : {},
        query.status === 'closed' ? { person: { status: false } } : {},
        nameContains ? { person: nameContains } : {},
        firstName
          ? {
              person: {
                firstName: { contains: firstName, mode: 'insensitive' },
              },
            }
          : {},
        middleName
          ? {
              person: {
                middleName: { contains: middleName, mode: 'insensitive' },
              },
            }
          : {},
        lastName
          ? {
              person: {
                lastName: { contains: lastName, mode: 'insensitive' },
              },
            }
          : {},
        searchContains,
      ],
    };
  }

  private searchFilter(search?: string): Prisma.DirectorWhereInput {
    if (!search) {
      return {};
    }

    const nameMatch = personNameContainsFilter(search);
    const parsedId = parseInt4FilterValue(search);

    return {
      OR: [
        ...(parsedId ? [{ id: parsedId }, { personId: parsedId }] : []),
        ...(nameMatch ? [{ person: nameMatch }] : []),
        {
          person: {
            phoneNumber: { contains: search, mode: 'insensitive' },
          },
        },
        {
          person: {
            email: { contains: search, mode: 'insensitive' },
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
}

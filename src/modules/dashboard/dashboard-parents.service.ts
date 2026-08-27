import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardParentsQueryDto } from './dto/dashboard-parents-query.dto';
import { DashboardParentsResponseDto } from './dto/dashboard-parents-response.dto';

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
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: parents.map((parent) => ({
        id: parent.id,
        fullName: this.formatFullName(parent.person),
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

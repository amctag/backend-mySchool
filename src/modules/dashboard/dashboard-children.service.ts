import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DashboardChildrenQueryDto } from './dto/dashboard-children-query.dto';
import { DashboardChildrenResponseDto } from './dto/dashboard-children-response.dto';

@Injectable()
export class DashboardChildrenService {
  constructor(private readonly prisma: PrismaService) {}

  async listChildren(
    user: AuthenticatedSchool,
    query: DashboardChildrenQueryDto,
  ): Promise<DashboardChildrenResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const schoolId = user.schoolId;

    if (query.parentId) {
      await this.assertParentVisible(schoolId, query.parentId);
    }

    const where = this.buildWhere(schoolId, query);

    const orderBy = this.buildOrderBy(query.sortBy, query.sortOrder);

    const [total, students] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        include: {
          person: {
            select: {
              username: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
          parent: {
            select: {
              id: true,
              person: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
            },
          },
          registrations: {
            where: {
              status: true,
              section: { schoolId },
            },
            include: {
              section: {
                select: {
                  class: { select: { className: true } },
                  sectionTitle: { select: { title: true } },
                  year: { select: { title: true, isCurrent: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: students.map((student) => {
        const registration =
          student.registrations.find((item) => item.section.year.isCurrent) ??
          student.registrations[0];

        return {
          id: student.id,
          fullName: this.formatFullName(student.person),
          firstName: student.person.firstName,
          lastName: student.person.lastName,
          username: student.person.username,
          parentId: student.parent?.id ?? null,
          parentName: student.parent
            ? this.formatFullName(student.parent.person)
            : null,
          className: registration?.section.class.className ?? null,
          sectionName: registration?.section.sectionTitle.title ?? null,
          yearTitle: registration?.section.year.title ?? null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async assertParentVisible(schoolId: number, parentId: number) {
    const parent = await this.prisma.parent.findFirst({
      where: {
        id: parentId,
        OR: [
          { person: { schoolId } },
          { students: { some: { person: { schoolId } } } },
        ],
      },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }
  }

  private buildWhere(
    schoolId: number,
    query: DashboardChildrenQueryDto,
  ): Prisma.StudentWhereInput {
    const nameContains = this.nameContainsFilter(query.name);
    const searchContains = this.searchFilter(query.search);

    return {
      AND: [
        { person: { schoolId } },
        query.parentId ? { parentId: query.parentId } : {},
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

  private searchFilter(search?: string): Prisma.StudentWhereInput {
    if (!search) {
      return {};
    }

    const nameMatch = this.nameContainsFilter(search);
    const parsedId = /^\d+$/.test(search) ? Number(search) : undefined;

    return {
      OR: [
        ...(parsedId ? [{ id: parsedId }] : []),
        ...(nameMatch ? [{ person: nameMatch }] : []),
        { person: { username: { contains: search, mode: 'insensitive' } } },
      ],
    };
  }

  private buildOrderBy(
    sortBy?: DashboardChildrenQueryDto['sortBy'],
    sortOrder?: DashboardChildrenQueryDto['sortOrder'],
  ): Prisma.StudentOrderByWithRelationInput[] {
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';
    const idTieBreaker: Prisma.StudentOrderByWithRelationInput = {
      id: direction,
    };

    if (sortBy === 'username') {
      return [{ person: { username: direction } }, idTieBreaker];
    }

    if (sortBy === 'name') {
      return [
        { person: { firstName: direction } },
        { person: { lastName: direction } },
        idTieBreaker,
      ];
    }

    if (sortBy === 'parent') {
      return [
        { parent: { person: { lastName: direction } } },
        { parent: { person: { firstName: direction } } },
        idTieBreaker,
      ];
    }

    if (sortBy === 'class') {
      return [{ registrations: { _count: direction } }, idTieBreaker];
    }

    return [{ id: direction }];
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

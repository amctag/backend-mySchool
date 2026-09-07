import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardAgendaDto } from './dto/create-dashboard-agenda.dto';
import { DashboardAgendasQueryDto } from './dto/dashboard-agendas-query.dto';
import {
  DashboardAgendaItemDto,
  DashboardAgendasResponseDto,
} from './dto/dashboard-agendas-response.dto';
import { UpdateDashboardAgendaDto } from './dto/update-dashboard-agenda.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const agendaInclude = {
  course: { select: { id: true, title: true, schoolId: true } },
  sections: {
    where: { deletedAt: null },
    include: {
      section: {
        select: {
          id: true,
          classId: true,
          yearId: true,
          class: { select: { className: true } },
          year: { select: { title: true } },
          sectionTitle: { select: { title: true } },
        },
      },
    },
  },
} as const;

type AgendaRecord = {
  id: number;
  description: string;
  agendaDate: Date;
  time: string;
  courseId: number;
  imageLink: string;
  fileLink: string;
  publishedDate: Date;
  status: number;
  course: { id: number; title: string; schoolId: number };
  sections: Array<{
    section: {
      id: number;
      classId: number;
      yearId: number;
      class: { className: string };
      year: { title: string };
      sectionTitle: { title: string };
    };
  }>;
};

@Injectable()
export class DashboardAgendasService {
  constructor(private readonly prisma: PrismaService) {}

  async listAgendas(
    user: AuthenticatedSchool,
    query: DashboardAgendasQueryDto,
  ): Promise<DashboardAgendasResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'agendaDate';
    const sortOrder = query.sortOrder ?? 'desc';
    const where = this.buildWhere(user.schoolId, query);

    const [rows, total] = await Promise.all([
      this.prisma.agenda.findMany({
        where,
        include: agendaInclude,
        orderBy: this.buildOrderBy(sortBy, sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.agenda.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getAgenda(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAgendaItemDto> {
    const row = await this.findAgenda(user.schoolId, id);
    return this.toItem(row);
  }

  async createAgenda(
    user: AuthenticatedSchool,
    dto: CreateDashboardAgendaDto,
  ): Promise<DashboardAgendaItemDto> {
    await this.assertCreatorPersonExists();
    await this.assertCourse(user.schoolId, dto.courseId);
    const sectionIds = await this.assertSections(user.schoolId, dto.sectionIds);
    const day = this.parseDateOnly(dto.agendaDate);

    const created = await this.prisma.agenda.create({
      data: {
        description: dto.description.trim(),
        agendaDate: day,
        time: dto.time.trim(),
        personId: DASHBOARD_CREATOR_PERSON_ID,
        courseId: dto.courseId,
        imageLink: dto.imageLink?.trim() || '',
        fileLink: dto.fileLink?.trim() || '',
        publishedDate: new Date(),
        status: dto.status ?? 1,
        sections: {
          create: sectionIds.map((sectionId) => ({ sectionId })),
        },
      },
      include: agendaInclude,
    });

    return this.toItem(created);
  }

  async updateAgenda(
    user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardAgendaDto,
  ): Promise<DashboardAgendaItemDto> {
    await this.findAgenda(user.schoolId, id);

    if (dto.courseId !== undefined) {
      await this.assertCourse(user.schoolId, dto.courseId);
    }

    let sectionIds: number[] | undefined;
    if (dto.sectionIds !== undefined) {
      sectionIds = await this.assertSections(user.schoolId, dto.sectionIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (sectionIds) {
        await tx.agendaSection.deleteMany({ where: { agendaId: id } });
        await tx.agendaSection.createMany({
          data: sectionIds.map((sectionId) => ({
            agendaId: id,
            sectionId,
          })),
        });
      }

      return tx.agenda.update({
        where: { id },
        data: {
          ...(dto.description !== undefined
            ? { description: dto.description.trim() }
            : {}),
          ...(dto.agendaDate !== undefined
            ? { agendaDate: this.parseDateOnly(dto.agendaDate) }
            : {}),
          ...(dto.time !== undefined ? { time: dto.time.trim() } : {}),
          ...(dto.courseId !== undefined ? { courseId: dto.courseId } : {}),
          ...(dto.imageLink !== undefined
            ? { imageLink: dto.imageLink.trim() }
            : {}),
          ...(dto.fileLink !== undefined
            ? { fileLink: dto.fileLink.trim() }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: agendaInclude,
      });
    });

    return this.toItem(updated);
  }

  async deleteAgenda(user: AuthenticatedSchool, id: number): Promise<void> {
    await this.findAgenda(user.schoolId, id);
    await this.prisma.agenda.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 0,
      },
    });
  }

  private async findAgenda(schoolId: number, id: number) {
    const row = await this.prisma.agenda.findFirst({
      where: {
        id,
        deletedAt: null,
        course: { schoolId },
      },
      include: agendaInclude,
    });
    if (!row) {
      throw new NotFoundException('Agenda not found');
    }
    return row;
  }

  private async assertCourse(schoolId: number, courseId: number) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, schoolId, status: true },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
  }

  private async assertSections(
    schoolId: number,
    sectionIds: number[],
  ): Promise<number[]> {
    const unique = [...new Set(sectionIds)];
    if (unique.length === 0) {
      throw new BadRequestException('Select at least one section');
    }
    const sections = await this.prisma.section.findMany({
      where: { id: { in: unique }, schoolId },
      select: { id: true },
    });
    if (sections.length !== unique.length) {
      throw new BadRequestException('One or more sections are invalid');
    }
    return unique;
  }

  private buildWhere(
    schoolId: number,
    query: DashboardAgendasQueryDto,
  ): Prisma.AgendaWhereInput {
    const where: Prisma.AgendaWhereInput = {
      deletedAt: null,
      course: { schoolId },
    };

    if (query.courseId) {
      where.courseId = query.courseId;
    }
    if (query.status !== undefined) {
      where.status = query.status;
    }
    if (query.agendaDate) {
      where.agendaDate = this.parseDateOnly(query.agendaDate);
    }
    if (query.search?.trim()) {
      where.description = {
        contains: query.search.trim(),
        mode: 'insensitive',
      };
    }

    if (query.sectionId || query.classId || query.yearId) {
      where.sections = {
        some: {
          deletedAt: null,
          section: {
            schoolId,
            ...(query.sectionId ? { id: query.sectionId } : {}),
            ...(query.classId ? { classId: query.classId } : {}),
            ...(query.yearId ? { yearId: query.yearId } : {}),
          },
        },
      };
    }

    return where;
  }

  private buildOrderBy(
    sortBy: NonNullable<DashboardAgendasQueryDto['sortBy']>,
    sortOrder: 'asc' | 'desc',
  ): Prisma.AgendaOrderByWithRelationInput {
    switch (sortBy) {
      case 'course':
        return { course: { title: sortOrder } };
      case 'status':
        return { status: sortOrder };
      case 'publishedDate':
        return { publishedDate: sortOrder };
      case 'id':
        return { id: sortOrder };
      case 'agendaDate':
      default:
        return { agendaDate: sortOrder };
    }
  }

  private toItem(row: AgendaRecord): DashboardAgendaItemDto {
    const sections = row.sections.map((link) => ({
      sectionId: link.section.id,
      sectionTitle: link.section.sectionTitle.title,
      classId: link.section.classId,
      className: link.section.class.className,
      yearId: link.section.yearId,
      yearTitle: link.section.year.title,
    }));

    return {
      id: row.id,
      description: row.description,
      agendaDate: this.formatDate(row.agendaDate),
      time: row.time,
      courseId: row.courseId,
      courseTitle: row.course.title,
      imageLink: row.imageLink,
      fileLink: row.fileLink,
      publishedDate: row.publishedDate.toISOString(),
      status: row.status,
      sections,
      sectionsLabel: sections
        .map((item) => `${item.className}/${item.sectionTitle}`)
        .join(', '),
    };
  }

  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
      throw new BadRequestException('Date must be YYYY-MM-DD');
    }
    const date = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return date;
  }

  private formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private async assertCreatorPersonExists(): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: DASHBOARD_CREATOR_PERSON_ID },
      select: { id: true },
    });
    if (!person) {
      throw new BadRequestException('Creator person not found');
    }
  }
}

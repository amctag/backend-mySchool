import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardAgendaSectionDto } from './dto/create-dashboard-agenda-section.dto';
import { DashboardAgendaSectionsQueryDto } from './dto/dashboard-agenda-sections-query.dto';
import {
  DashboardAgendaSectionRowDto,
  DashboardAgendaSectionsResponseDto,
} from './dto/dashboard-agenda-sections-response.dto';
import { UpdateDashboardAgendaSectionDto } from './dto/update-dashboard-agenda-section.dto';

const rowInclude = {
  agenda: {
    select: {
      id: true,
      description: true,
      agendaDate: true,
      deletedAt: true,
      course: { select: { title: true, schoolId: true } },
    },
  },
  section: {
    select: {
      id: true,
      classId: true,
      yearId: true,
      schoolId: true,
      class: { select: { className: true } },
      year: { select: { title: true } },
      sectionTitle: { select: { title: true } },
    },
  },
} as const;

type AgendaSectionRecord = {
  id: number;
  agendaId: number;
  sectionId: number;
  agenda: {
    id: number;
    description: string;
    agendaDate: Date;
    deletedAt: Date | null;
    course: { title: string; schoolId: number };
  };
  section: {
    id: number;
    classId: number;
    yearId: number;
    schoolId: number;
    class: { className: string };
    year: { title: string };
    sectionTitle: { title: string };
  };
};

@Injectable()
export class DashboardAgendaSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listAgendaSections(
    user: AuthenticatedSchool,
    query: DashboardAgendaSectionsQueryDto,
  ): Promise<DashboardAgendaSectionsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortBy = query.sortBy ?? 'id';
    const sortOrder = query.sortOrder ?? 'desc';
    const where = this.buildWhere(user.schoolId, query);

    const [rows, total] = await Promise.all([
      this.prisma.agendaSection.findMany({
        where,
        include: rowInclude,
        orderBy: this.buildOrderBy(sortBy, sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.agendaSection.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getAgendaSection(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAgendaSectionRowDto> {
    const row = await this.findRow(user.schoolId, id);
    return this.toItem(row);
  }

  async createAgendaSection(
    user: AuthenticatedSchool,
    dto: CreateDashboardAgendaSectionDto,
  ): Promise<DashboardAgendaSectionRowDto> {
    await this.assertAgenda(user.schoolId, dto.agendaId);
    await this.assertSection(user.schoolId, dto.sectionId);
    await this.assertPairAvailable(dto.agendaId, dto.sectionId);

    const existing = await this.prisma.agendaSection.findFirst({
      where: { agendaId: dto.agendaId, sectionId: dto.sectionId },
    });

    const row = existing
      ? await this.prisma.agendaSection.update({
          where: { id: existing.id },
          data: { deletedAt: null },
          include: rowInclude,
        })
      : await this.prisma.agendaSection.create({
          data: {
            agendaId: dto.agendaId,
            sectionId: dto.sectionId,
          },
          include: rowInclude,
        });

    return this.toItem(row);
  }

  async updateAgendaSection(
    user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardAgendaSectionDto,
  ): Promise<DashboardAgendaSectionRowDto> {
    const current = await this.findRow(user.schoolId, id);
    const agendaId = dto.agendaId ?? current.agendaId;
    const sectionId = dto.sectionId ?? current.sectionId;

    if (dto.agendaId !== undefined) {
      await this.assertAgenda(user.schoolId, dto.agendaId);
    }
    if (dto.sectionId !== undefined) {
      await this.assertSection(user.schoolId, dto.sectionId);
    }
    if (agendaId !== current.agendaId || sectionId !== current.sectionId) {
      await this.assertPairAvailable(agendaId, sectionId, id);
      const stale = await this.prisma.agendaSection.findFirst({
        where: {
          agendaId,
          sectionId,
          id: { not: id },
          deletedAt: { not: null },
        },
        select: { id: true },
      });
      if (stale) {
        await this.prisma.agendaSection.delete({ where: { id: stale.id } });
      }
    }

    const updated = await this.prisma.agendaSection.update({
      where: { id },
      data: { agendaId, sectionId },
      include: rowInclude,
    });

    return this.toItem(updated);
  }

  async deleteAgendaSection(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<void> {
    await this.findRow(user.schoolId, id);
    await this.prisma.agendaSection.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async findRow(schoolId: number, id: number) {
    const row = await this.prisma.agendaSection.findFirst({
      where: {
        id,
        deletedAt: null,
        agenda: { deletedAt: null, course: { schoolId } },
        section: { schoolId },
      },
      include: rowInclude,
    });
    if (!row) {
      throw new NotFoundException('Agenda section not found');
    }
    return row;
  }

  private async assertAgenda(schoolId: number, agendaId: number) {
    const agenda = await this.prisma.agenda.findFirst({
      where: { id: agendaId, deletedAt: null, course: { schoolId } },
      select: { id: true },
    });
    if (!agenda) {
      throw new NotFoundException('Agenda not found');
    }
  }

  private async assertSection(schoolId: number, sectionId: number) {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, schoolId },
      select: { id: true },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
  }

  private async assertPairAvailable(
    agendaId: number,
    sectionId: number,
    excludeId?: number,
  ) {
    const existing = await this.prisma.agendaSection.findFirst({
      where: {
        agendaId,
        sectionId,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This agenda is already assigned to that section',
      );
    }
  }

  private buildWhere(
    schoolId: number,
    query: DashboardAgendaSectionsQueryDto,
  ): Prisma.AgendaSectionWhereInput {
    const where: Prisma.AgendaSectionWhereInput = {
      deletedAt: null,
      agenda: {
        deletedAt: null,
        course: { schoolId },
        ...(query.agendaId ? { id: query.agendaId } : {}),
        ...(query.search?.trim()
          ? {
              description: {
                contains: query.search.trim(),
                mode: 'insensitive',
              },
            }
          : {}),
      },
      section: {
        schoolId,
        ...(query.sectionId ? { id: query.sectionId } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.yearId ? { yearId: query.yearId } : {}),
      },
    };

    return where;
  }

  private buildOrderBy(
    sortBy: NonNullable<DashboardAgendaSectionsQueryDto['sortBy']>,
    sortOrder: 'asc' | 'desc',
  ): Prisma.AgendaSectionOrderByWithRelationInput {
    switch (sortBy) {
      case 'agendaDate':
        return { agenda: { agendaDate: sortOrder } };
      case 'section':
        return { section: { sectionTitle: { title: sortOrder } } };
      case 'id':
      default:
        return { id: sortOrder };
    }
  }

  private toItem(row: AgendaSectionRecord): DashboardAgendaSectionRowDto {
    return {
      id: row.id,
      agendaId: row.agendaId,
      agendaDescription: row.agenda.description,
      agendaDate: row.agenda.agendaDate.toISOString().slice(0, 10),
      courseTitle: row.agenda.course.title,
      sectionId: row.sectionId,
      sectionTitle: row.section.sectionTitle.title,
      classId: row.section.classId,
      className: row.section.class.className,
      yearId: row.section.yearId,
      yearTitle: row.section.year.title,
    };
  }
}

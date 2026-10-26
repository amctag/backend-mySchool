import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  DirectorAgendasQueryDto,
  DirectorAgendaItemDto,
  DirectorAgendasResponseDto,
} from './dto/director-agenda.dto';

@Injectable()
export class DirectorAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listAgendas(
    user: AuthenticatedDirector,
    query: DirectorAgendasQueryDto,
  ): Promise<DirectorAgendasResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });

    const where: any = {
      course: { schoolId: user.schoolId },
      ...(query.date ? { agendaDate: query.date } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.agenda.count({ where }),
      this.prisma.agenda.findMany({
        where,
        orderBy: [{ agendaDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        date: row.agendaDate?.toISOString().split('T')[0],
        title: row.title,
        description: row.description,
        startDate: row.agendaDate?.toISOString().split('T')[0] || '',
        endDate: '',
        courseTitle: '',
        gradeLevels: [],
        sectionTitles: [],
        createdBy: '',
        createdAt: row.createdAt?.toISOString().split('T')[0] || '',
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getAgenda(
    user: AuthenticatedDirector,
    agendaId: number,
  ): Promise<DirectorAgendaItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const agenda = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        course: { schoolId: user.schoolId },
      },
    });

    if (!agenda) {
      throw new NotFoundException('Agenda item not found');
    }

    return {
      id: agenda.id,
      date: agenda.agendaDate?.toISOString().split('T')[0],
      title: agenda.title,
      description: agenda.description,
      startDate: agenda.agendaDate?.toISOString().split('T')[0] || '',
      endDate: '',
      courseTitle: '',
      gradeLevels: [],
      sectionTitles: [],
      createdBy: '',
      createdAt: agenda.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async createAgenda(
    user: AuthenticatedDirector,
    dto: any,
  ): Promise<DirectorAgendaItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const agenda = await this.prisma.agenda.create({
      data: {
        title: dto.title,
        description: dto.description,
        agendaDate: dto.startDate,
        time: dto.startDate ? '09:00' : '',
        personId: user.personId,
        courseId: 1,
        imageLink: '',
        fileLink: '',
        publishedDate: new Date(),
        status: 1,
      },
    });

    return {
      id: agenda.id,
      date: agenda.agendaDate?.toISOString().split('T')[0],
      title: agenda.title,
      description: agenda.description,
      startDate: agenda.agendaDate?.toISOString().split('T')[0] || '',
      endDate: '',
      courseTitle: '',
      gradeLevels: [],
      sectionTitles: [],
      createdBy: '',
      createdAt: agenda.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async updateAgenda(
    user: AuthenticatedDirector,
    agendaId: number,
    dto: any,
  ): Promise<DirectorAgendaItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const agenda = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        course: { schoolId: user.schoolId },
      },
    });

    if (!agenda) {
      throw new NotFoundException('Agenda item not found');
    }

    const updated = await this.prisma.agenda.update({
      where: { id: agendaId },
      data: {
        title: dto.title,
        description: dto.description,
        agendaDate: dto.startDate,
      },
    });

    return {
      id: updated.id,
      date: updated.agendaDate?.toISOString().split('T')[0],
      title: updated.title,
      description: updated.description,
      startDate: updated.agendaDate?.toISOString().split('T')[0] || '',
      endDate: '',
      courseTitle: '',
      gradeLevels: [],
      sectionTitles: [],
      createdBy: '',
      createdAt: updated.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async deleteAgenda(
    user: AuthenticatedDirector,
    agendaId: number,
  ): Promise<boolean> {
    this.directorAccess.ensureDirectorRole(user.role);

    const agenda = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        course: { schoolId: user.schoolId },
      },
    });

    if (!agenda) {
      throw new NotFoundException('Agenda item not found');
    }

    await this.prisma.agenda.delete({
      where: { id: agendaId },
    });

    return true;
  }
}

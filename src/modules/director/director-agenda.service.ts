import {
  BadRequestException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
import { parseDateOnly } from '../teacher/teacher.util';

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

    const dateFilter = this.dateFilter(query.date, query.month);
    const where: any = {
      course: { schoolId: user.schoolId },
      ...(dateFilter ? { agendaDate: dateFilter } : {}),
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

  private dateFilter(
    date?: string,
    month?: string,
  ): { gte: Date; lt: Date } | undefined {
    if (date && month) {
      throw new BadRequestException('Use either date or month, not both');
    }
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestException('date must use YYYY-MM-DD format');
      }
      const day = parseDateOnly(date);
      const [year, monthNumber, dayNumber] = date.split('-').map(Number);
      if (
        Number.isNaN(day.getTime()) ||
        day.getUTCFullYear() !== year ||
        day.getUTCMonth() + 1 !== monthNumber ||
        day.getUTCDate() !== dayNumber
      ) {
        throw new BadRequestException('date must be a valid calendar date');
      }
      const next = new Date(day);
      next.setUTCDate(next.getUTCDate() + 1);
      return { gte: day, lt: next };
    }
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new BadRequestException('month must use YYYY-MM format');
      }
      const [year, monthNumber] = month.split('-').map(Number);
      const start = new Date(Date.UTC(year, monthNumber - 1, 1));
      if (
        monthNumber < 1 ||
        monthNumber > 12 ||
        Number.isNaN(start.getTime())
      ) {
        throw new BadRequestException('month must be a valid calendar month');
      }
      return { gte: start, lt: new Date(Date.UTC(year, monthNumber, 1)) };
    }
    return undefined;
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

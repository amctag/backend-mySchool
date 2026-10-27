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
import { formatClassLabel } from './director.util';
import { parseDateOnly } from '../teacher/teacher.util';

const agendaInclude = {
  sections: {
    include: {
      section: {
        include: {
          class: { select: { className: true } },
          sectionTitle: { select: { title: true } },
        },
      },
    },
  },
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
    },
  },
} as const;

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
      courseId: user.schoolId,
      ...(dateFilter ? { agendaDate: dateFilter } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.agenda.count({ where }),
      this.prisma.agenda.findMany({
        where,
        include: agendaInclude,
        orderBy: [{ agendaDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    // Preload course titles in batch
    const courseIds = [...new Set(rows.map((row) => row.courseId).filter((id): id is number => id != null))];
    const courseMap = new Map<number, string>();
    if (courseIds.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds } },
      });
      courses.forEach((course) => courseMap.set(course.id, course.title ?? ''));
    }

    return {
      items: rows.map((row) => {
        const section = row.sections?.[0]?.section;
        const classId = section?.id ?? 0;
        const classLabel = section
          ? formatClassLabel(section.class.className, section.sectionTitle.title)
          : '';
        const person = row.person;
        const assignmentId = person?.id ?? row.id;
        const createdBy = person
          ? `${person.firstName || ''} ${person.lastName || ''}`.trim() ||
            person.username ||
            ''
          : '';

        return {
          id: row.id,
          assignmentId: assignmentId,
          classId: classId,
          classLabel: classLabel,
          courseTitle: row.courseId != null ? courseMap.get(row.courseId) ?? '' : '',
          title: row.title,
          description: row.description,
          date: row.agendaDate?.toISOString().split('T')[0] ?? '',
          publishDate: row.agendaDate?.toISOString().split('T')[0] ?? '',
          time: row.time ?? '09:00',
          imageLink: row.imageLink ?? '',
          fileLink: row.fileLink ?? '',
          createdBy: createdBy,
          createdAt: row.createdAt?.toISOString().split('T')[0] ?? '',
        };
      }),
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
        courseId: user.schoolId,
      },
    });

    if (!agenda) {
      throw new NotFoundException('Agenda item not found');
    }

    let courseTitle = '';
    if (agenda.courseId != null) {
      const course = await this.prisma.course.findUnique({ where: { id: agenda.courseId } });
      courseTitle = course?.title ?? '';
    }

    return {
      id: agenda.id,
      assignmentId: agenda.id,
      classId: agenda.personId ?? 0,
      classLabel: '',
      courseTitle,
      title: agenda.title,
      description: agenda.description,
      date: agenda.agendaDate?.toISOString().split('T')[0] ?? '',
      publishDate: agenda.agendaDate?.toISOString().split('T')[0] ?? '',
      time: agenda.time ?? '09:00',
      imageLink: agenda.imageLink ?? '',
      fileLink: agenda.fileLink ?? '',
      createdBy: '',
      createdAt: agenda.createdAt?.toISOString().split('T')[0] ?? '',
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
        agendaDate: dto.date,
        time: dto.time ?? '09:00',
        personId: user.personId,
        courseId: dto.courseId ?? 1,
        imageLink: dto.imageLink ?? '',
        fileLink: dto.fileLink ?? '',
        publishedDate: new Date(),
        status: 1,
      },
    });

    let courseTitle = '';
    if (agenda.courseId != null) {
      const course = await this.prisma.course.findUnique({ where: { id: agenda.courseId } });
      courseTitle = course?.title ?? '';
    }

    return {
      id: agenda.id,
      assignmentId: agenda.id,
      classId: agenda.personId ?? 0,
      classLabel: '',
      courseTitle,
      title: agenda.title,
      description: agenda.description,
      date: agenda.agendaDate?.toISOString().split('T')[0] ?? '',
      publishDate: agenda.agendaDate?.toISOString().split('T')[0] ?? '',
      time: agenda.time ?? '09:00',
      imageLink: agenda.imageLink ?? '',
      fileLink: agenda.fileLink ?? '',
      createdBy: '',
      createdAt: agenda.createdAt?.toISOString().split('T')[0] ?? '',
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
        courseId: user.schoolId,
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
        agendaDate: dto.date,
        time: dto.time,
      },
    });

    let courseTitle = '';
    if (updated.courseId != null) {
      const course = await this.prisma.course.findUnique({ where: { id: updated.courseId } });
      courseTitle = course?.title ?? '';
    }

    return {
      id: updated.id,
      assignmentId: updated.id,
      classId: updated.personId ?? 0,
      classLabel: '',
      courseTitle,
      title: updated.title,
      description: updated.description,
      date: updated.agendaDate?.toISOString().split('T')[0] ?? '',
      publishDate: updated.agendaDate?.toISOString().split('T')[0] ?? '',
      time: updated.time ?? '09:00',
      imageLink: updated.imageLink ?? '',
      fileLink: updated.fileLink ?? '',
      createdBy: '',
      createdAt: updated.createdAt?.toISOString().split('T')[0] ?? '',
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
        courseId: user.schoolId,
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
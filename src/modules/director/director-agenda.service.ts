import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { parseDateOnly } from '../teacher/teacher.util';
import { DirectorAccessService } from './director-access.service';
import {
  AGENDA_STATUS_DRAFT,
  AGENDA_STATUS_PUBLISHED,
  DRAFT_PUBLISHED_DATE,
  normalizeAgendaTime,
  parseAgendaDate,
  prismaErrorCode,
  resolveAgendaAttachment,
  toDateOnly,
} from './director-agenda.helpers';
import {
  DirectorAgendaItemDto,
  DirectorAgendasQueryDto,
  DirectorAgendasResponseDto,
  DirectorUpsertAgendaDto,
} from './dto/director-agenda.dto';
import { formatClassLabel } from './director.util';

// Kept for backwards compatibility with existing imports/tests.
export { resolveAgendaAttachment };

const DEFAULT_TIME = '09:00';

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
    select: { id: true, firstName: true, lastName: true, username: true },
  },
} as const;

type AgendaRow = {
  id: number;
  title: string;
  description: string;
  agendaDate: Date | null;
  time: string | null;
  imageLink: string | null;
  fileLink: string | null;
  createdAt: Date | null;
  status: number;
};

type PersonRow = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
} | null | undefined;

function personName(person: PersonRow): string {
  if (!person) return '';
  return (
    `${person.firstName || ''} ${person.lastName || ''}`.trim() ||
    person.username ||
    ''
  );
}

function toItem(
  row: AgendaRow,
  extra: {
    assignmentId: number;
    classId: number;
    classLabel: string;
    courseTitle: string;
    createdBy?: string;
  },
): DirectorAgendaItemDto {
  const date = toDateOnly(row.agendaDate);
  return {
    id: row.id,
    assignmentId: extra.assignmentId,
    classId: extra.classId,
    classLabel: extra.classLabel,
    courseTitle: extra.courseTitle,
    title: row.title,
    description: row.description,
    date,
    publishDate: date,
    time: row.time ?? DEFAULT_TIME,
    imageLink: row.imageLink ?? '',
    fileLink: row.fileLink ?? '',
    createdBy: extra.createdBy ?? '',
    createdAt: toDateOnly(row.createdAt),
    published: row.status === AGENDA_STATUS_PUBLISHED,
    status: row.status,
  };
}

@Injectable()
export class DirectorAgendaService {
  private readonly logger = new Logger(DirectorAgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  /**
   * Runs a mutation and makes sure a failure is never silent: HTTP errors pass
   * through, known Prisma errors become 4xx, anything else is logged with its
   * stack trace (so the real cause of a 500 is visible in the server log) and
   * rethrown as a generic 500.
   */
  private async guard<T>(
    operation: string,
    user: AuthenticatedDirector,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const code = prismaErrorCode(error);
      const context = `agenda.${operation} school=${user.schoolId} person=${user.personId}`;
      if (code === 'P2000') {
        throw new BadRequestException('One of the values is too long');
      }
      if (code === 'P2003' || code === 'P2025') {
        throw new BadRequestException('Referenced record does not exist');
      }
      this.logger.error(
        `${context} failed${code ? ` [${code}]` : ''}: ${(error as Error)?.message}`,
        (error as Error)?.stack,
      );
      throw new InternalServerErrorException('Internal server error');
    }
  }

  private async resolveAssignment(
    user: AuthenticatedDirector,
    assignmentId: number,
    sectionId: number,
  ) {
    const yearId = await this.directorAccess.currentYearId(user.schoolId);
    const assignment = await this.prisma.teach.findFirst({
      where: {
        id: assignmentId,
        sectionId,
        ...(yearId ? { yearId } : {}),
        section: { schoolId: user.schoolId },
      },
      include: {
        course: { select: { id: true, title: true } },
        section: { include: { class: true, sectionTitle: true } },
      },
    });
    if (!assignment) {
      throw new BadRequestException(
        'Assignment does not belong to this section, school, or academic year',
      );
    }
    return assignment;
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
      if (monthNumber < 1 || monthNumber > 12) {
        throw new BadRequestException('month must be a valid calendar month');
      }
      return {
        gte: new Date(Date.UTC(year, monthNumber - 1, 1)),
        lt: new Date(Date.UTC(year, monthNumber, 1)),
      };
    }
    return undefined;
  }

  private async ensureAgendaInDirectorSchool(
    user: AuthenticatedDirector,
    agendaId: number,
  ) {
    this.directorAccess.ensureDirectorRole(user.role);

    // Scoped to the director's school and excluding soft-deleted rows. A
    // missing and a cross-school agenda return the same 404.
    const agenda = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        deletedAt: null,
        course: { schoolId: user.schoolId },
      },
      include: {
        course: { select: { schoolId: true, title: true } },
        person: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
        sections: {
          include: {
            section: { include: { class: true, sectionTitle: true } },
          },
        },
      },
    });

    if (!agenda || !agenda.course) {
      throw new NotFoundException('Agenda item not found');
    }
    return { agenda, course: agenda.course };
  }

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
    const where: Prisma.AgendaWhereInput = {
      deletedAt: null,
      ...(dateFilter ? { agendaDate: dateFilter } : {}),
      course: { schoolId: user.schoolId },
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

    const courseIds = [
      ...new Set(
        rows.map((row) => row.courseId).filter((id): id is number => id != null),
      ),
    ];
    const courseMap = new Map<number, string>();
    if (courseIds.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds } },
      });
      courses.forEach((course) => courseMap.set(course.id, course.title ?? ''));
    }

    const sectionIds = rows.flatMap((row) =>
      row.sections.map((item) => item.sectionId),
    );
    const yearId = sectionIds.length
      ? await this.directorAccess.currentYearId(user.schoolId)
      : null;
    const teaches = sectionIds.length
      ? await this.prisma.teach.findMany({
          where: {
            sectionId: { in: sectionIds },
            ...(yearId ? { yearId } : {}),
          },
          select: { id: true, sectionId: true, courseId: true },
        })
      : [];

    return {
      items: rows.map((row) => {
        const section = row.sections?.[0]?.section;
        return toItem(row, {
          assignmentId:
            teaches.find(
              (teach) =>
                teach.sectionId === section?.id &&
                teach.courseId === row.courseId,
            )?.id ?? 0,
          classId: section?.id ?? 0,
          classLabel: section
            ? formatClassLabel(
                section.class.className,
                section.sectionTitle.title,
              )
            : '',
          courseTitle:
            row.courseId != null ? (courseMap.get(row.courseId) ?? '') : '',
          createdBy: personName(row.person),
        });
      }),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getAgenda(
    user: AuthenticatedDirector,
    agendaId: number,
  ): Promise<DirectorAgendaItemDto> {
    const { agenda, course } = await this.ensureAgendaInDirectorSchool(
      user,
      agendaId,
    );
    const section = agenda.sections?.[0]?.section;
    const assignment = section
      ? await this.prisma.teach.findFirst({
          where: {
            sectionId: section.id,
            courseId: agenda.courseId,
            yearId: section.yearId,
          },
          select: { id: true },
        })
      : null;

    return toItem(agenda, {
      assignmentId: assignment?.id ?? 0,
      classId: section?.id ?? 0,
      classLabel: section
        ? formatClassLabel(section.class.className, section.sectionTitle.title)
        : '',
      courseTitle: course.title ?? '',
      createdBy: personName(agenda.person),
    });
  }

  async createAgenda(
    user: AuthenticatedDirector,
    dto: DirectorUpsertAgendaDto,
  ): Promise<DirectorAgendaItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);
    // Validate everything that can be rejected before touching the database.
    const agendaDate = parseAgendaDate(dto.date);
    const time = normalizeAgendaTime(dto.time) ?? DEFAULT_TIME;

    return this.guard('create', user, async () => {
      const assignment = await this.resolveAssignment(
        user,
        dto.assignmentId,
        dto.classId,
      );
      const published = dto.published === true;

      // Agenda + section link are one unit: never leave an orphan agenda.
      const agenda = await this.prisma.$transaction(async (tx) => {
        const created = await tx.agenda.create({
          data: {
            title: dto.title.trim(),
            description: dto.description,
            agendaDate,
            time,
            personId: user.personId,
            courseId: assignment.courseId,
            imageLink: resolveAgendaAttachment(dto.imageLink, ''),
            fileLink: resolveAgendaAttachment(dto.fileLink, ''),
            publishedDate: published ? new Date() : DRAFT_PUBLISHED_DATE,
            status: published ? AGENDA_STATUS_PUBLISHED : AGENDA_STATUS_DRAFT,
          },
        });
        await tx.agendaSection.create({
          data: { agendaId: created.id, sectionId: assignment.sectionId },
        });
        return created;
      });

      return toItem(agenda, {
        assignmentId: assignment.id,
        classId: assignment.sectionId,
        classLabel: formatClassLabel(
          assignment.section.class.className,
          assignment.section.sectionTitle.title,
        ),
        courseTitle: assignment.course?.title ?? '',
      });
    });
  }

  async updateAgenda(
    user: AuthenticatedDirector,
    agendaId: number,
    dto: DirectorUpsertAgendaDto,
  ): Promise<DirectorAgendaItemDto> {
    const { agenda } = await this.ensureAgendaInDirectorSchool(user, agendaId);
    const agendaDate = parseAgendaDate(dto.date);
    const time = normalizeAgendaTime(dto.time);

    return this.guard('update', user, async () => {
      const assignment = await this.resolveAssignment(
        user,
        dto.assignmentId,
        dto.classId,
      );
      const publishNow =
        dto.published === true && agenda.status !== AGENDA_STATUS_PUBLISHED;

      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.agendaSection.deleteMany({ where: { agendaId } });
        const saved = await tx.agenda.update({
          where: { id: agendaId },
          data: {
            title: dto.title.trim(),
            description: dto.description,
            agendaDate,
            ...(time ? { time } : {}),
            // personId is intentionally untouched: the original creator stays.
            courseId: assignment.courseId,
            imageLink: resolveAgendaAttachment(
              dto.imageLink,
              agenda.imageLink ?? '',
            ),
            fileLink: resolveAgendaAttachment(
              dto.fileLink,
              agenda.fileLink ?? '',
            ),
            ...(publishNow
              ? {
                  status: AGENDA_STATUS_PUBLISHED,
                  publishedDate: new Date(),
                }
              : {}),
          },
        });
        await tx.agendaSection.create({
          data: { agendaId, sectionId: assignment.sectionId },
        });
        return saved;
      });

      return toItem(updated, {
        assignmentId: assignment.id,
        classId: assignment.sectionId,
        classLabel: formatClassLabel(
          assignment.section.class.className,
          assignment.section.sectionTitle.title,
        ),
        courseTitle: assignment.course?.title ?? '',
        createdBy: personName(agenda.person),
      });
    });
  }

  async publishAgenda(
    user: AuthenticatedDirector,
    agendaId: number,
  ): Promise<DirectorAgendaItemDto> {
    const { agenda } = await this.ensureAgendaInDirectorSchool(user, agendaId);

    return this.guard('publish', user, async () => {
      if (agenda.status !== AGENDA_STATUS_PUBLISHED) {
        await this.prisma.agenda.update({
          where: { id: agendaId },
          data: { status: AGENDA_STATUS_PUBLISHED, publishedDate: new Date() },
        });
      }
      // Re-read so the response carries the real assignment/class/status.
      return this.getAgenda(user, agendaId);
    });
  }

  async deleteAgenda(
    user: AuthenticatedDirector,
    agendaId: number,
  ): Promise<boolean> {
    await this.ensureAgendaInDirectorSchool(user, agendaId);

    return this.guard('delete', user, async () => {
      await this.prisma.agenda.update({
        where: { id: agendaId },
        data: { deletedAt: new Date() },
      });
      return true;
    });
  }
}

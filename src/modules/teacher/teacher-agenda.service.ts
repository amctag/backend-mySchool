import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  TeacherAgendaItemDto,
  TeacherAgendasQueryDto,
  TeacherAgendasResponseDto,
  UpsertTeacherAgendaDto,
} from './dto/teacher-agenda.dto';
import { TeacherMessageResponseDto } from './dto/teacher-auth.dto';
import {
  formatClassLabel,
  formatDateOnly,
  formatDateTime,
  parseDateOnly,
} from './teacher.util';

const agendaInclude = {
  course: { select: { id: true, title: true } },
  sections: {
    where: { deletedAt: null },
    include: {
      section: {
        select: {
          id: true,
          class: { select: { className: true } },
          sectionTitle: { select: { title: true } },
        },
      },
    },
  },
} as const;

type AgendaRecord = Prisma.AgendaGetPayload<{ include: typeof agendaInclude }>;

@Injectable()
export class TeacherAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listAgendas(
    user: AuthenticatedTeacher,
    query: TeacherAgendasQueryDto,
  ): Promise<TeacherAgendasResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 100,
    });

    const where: Prisma.AgendaWhereInput = {
      deletedAt: null,
      personId: user.id,
      course: { schoolId: user.schoolId },
      ...(query.classId
        ? { sections: { some: { deletedAt: null, sectionId: query.classId } } }
        : {}),
      ...(query.agendaDate
        ? { agendaDate: parseDateOnly(query.agendaDate) }
        : {}),
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

    const assignmentIds = await this.resolveAssignmentIds(
      user,
      rows.map((row) => ({
        courseId: row.courseId,
        sectionId: row.sections[0]?.section.id,
      })),
    );

    return {
      items: rows.map((row) => this.toItem(row, assignmentIds)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async createAgenda(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherAgendaDto,
  ): Promise<TeacherAgendaItemDto> {
    const assignment = await this.assertWritableAssignment(user, dto);

    const created = await this.prisma.agenda.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        agendaDate: parseDateOnly(dto.date),
        time: dto.time?.trim() || '08:00',
        personId: user.id,
        courseId: assignment.courseId,
        imageLink: '',
        fileLink: dto.attachmentUrl?.trim() || '',
        publishedDate: new Date(),
        status: 1,
        sections: { create: { sectionId: assignment.sectionId } },
      },
      include: agendaInclude,
    });

    return this.toItem(created, new Map([[this.key(assignment.courseId, assignment.sectionId), assignment.id]]));
  }

  async getAgenda(
    user: AuthenticatedTeacher,
    agendaId: number,
  ): Promise<TeacherAgendaItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const row = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        personId: user.id,
        deletedAt: null,
        course: { schoolId: user.schoolId },
      },
      include: agendaInclude,
    });
    if (!row) {
      throw new NotFoundException('Agenda not found');
    }

    const assignmentIds = await this.resolveAssignmentIds(user, [
      {
        courseId: row.courseId,
        sectionId: row.sections[0]?.section.id,
      },
    ]);
    return this.toItem(row, assignmentIds);
  }

  async updateAgenda(
    user: AuthenticatedTeacher,
    agendaId: number,
    dto: UpsertTeacherAgendaDto,
  ): Promise<TeacherAgendaItemDto> {
    await this.findOwnAgenda(user, agendaId);
    const assignment = await this.assertWritableAssignment(user, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.agendaSection.deleteMany({ where: { agendaId } });
      await tx.agendaSection.create({
        data: { agendaId, sectionId: assignment.sectionId },
      });

      return tx.agenda.update({
        where: { id: agendaId },
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          agendaDate: parseDateOnly(dto.date),
          time: dto.time?.trim() || '08:00',
          courseId: assignment.courseId,
          fileLink: dto.attachmentUrl?.trim() || '',
        },
        include: agendaInclude,
      });
    });

    return this.toItem(
      updated,
      new Map([[this.key(assignment.courseId, assignment.sectionId), assignment.id]]),
    );
  }

  async deleteAgenda(
    user: AuthenticatedTeacher,
    agendaId: number,
  ): Promise<TeacherMessageResponseDto> {
    await this.findOwnAgenda(user, agendaId);
    await this.prisma.agenda.update({
      where: { id: agendaId },
      data: { deletedAt: new Date(), status: 0 },
    });
    return { message: 'Agenda deleted successfully' };
  }

  private async findOwnAgenda(user: AuthenticatedTeacher, agendaId: number) {
    const row = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        personId: user.id,
        deletedAt: null,
        course: { schoolId: user.schoolId },
      },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Agenda not found');
    }
  }

  private async assertWritableAssignment(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherAgendaDto,
  ) {
    const assignment = await this.teacherAccess.getAssignment(
      user,
      dto.assignmentId,
    );
    if (assignment.sectionId !== dto.classId) {
      throw new BadRequestException(
        'classId does not match the teaching assignment',
      );
    }
    return assignment;
  }

  private async resolveAssignmentIds(
    user: AuthenticatedTeacher,
    pairs: Array<{ courseId: number; sectionId?: number }>,
  ) {
    const valid = pairs.filter(
      (pair): pair is { courseId: number; sectionId: number } =>
        pair.sectionId !== undefined,
    );
    if (valid.length === 0) {
      return new Map<string, number>();
    }

    const rows = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        OR: valid.map((pair) => ({
          courseId: pair.courseId,
          sectionId: pair.sectionId,
        })),
      },
      select: { id: true, courseId: true, sectionId: true },
    });

    return new Map(
      rows.map((row) => [this.key(row.courseId, row.sectionId), row.id]),
    );
  }

  private toItem(
    row: AgendaRecord,
    assignmentIds: Map<string, number>,
  ): TeacherAgendaItemDto {
    const section = row.sections[0]?.section;
    if (!section) {
      throw new ForbiddenException('Agenda is missing a class');
    }

    return {
      id: row.id,
      assignmentId: assignmentIds.get(this.key(row.courseId, section.id)) ?? 0,
      classId: section.id,
      classLabel: formatClassLabel(
        section.class.className,
        section.sectionTitle.title,
      ),
      courseTitle: row.course.title,
      title: row.title || row.course.title,
      description: row.description,
      date: formatDateOnly(row.agendaDate),
      publishDate: formatDateTime(row.publishedDate),
      time: row.time,
      attachmentUrl: row.fileLink || null,
    };
  }

  private key(courseId: number, sectionId: number): string {
    return `${sectionId}:${courseId}`;
  }
}

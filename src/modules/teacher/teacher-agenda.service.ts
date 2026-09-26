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
import { ParentFcmNotifyService } from '../../fcm/parent-fcm-notify.service';
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
  monthDateRange,
  parseDateOnly,
} from './teacher.util';
import { normalizePublicMediaUrl } from '../../upload/media-upload.service';

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

/** draft = author only; saved = school/supervisor; published = parents */
const AGENDA_STATUS = {
  draft: 0,
  saved: 2,
  published: 1,
} as const;

type AgendaStatusLabel = keyof typeof AGENDA_STATUS;

function agendaStatusLabel(status: number): AgendaStatusLabel {
  if (status === AGENDA_STATUS.published) {
    return 'published';
  }
  if (status === AGENDA_STATUS.saved) {
    return 'saved';
  }
  return 'draft';
}

function agendaStatusCode(label: AgendaStatusLabel): number {
  return AGENDA_STATUS[label];
}

@Injectable()
export class TeacherAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
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

    const sectionIds = await this.teacherAccess.taughtOrSupervisedSectionIds(
      user,
    );
    const schoolCanPublish = await this.teachersCanPublishAgenda(user.schoolId);
    const supervisedIds = await this.teacherAccess.supervisedSectionIds(user);
    if (sectionIds.length === 0) {
      return {
        items: [],
        pagination: buildPaginationMeta(page, limit, 0),
        teachersCanPublishAgenda: schoolCanPublish,
      };
    }

    const filterSectionIds =
      query.classId != null
        ? sectionIds.includes(query.classId)
          ? [query.classId]
          : []
        : sectionIds;

    if (filterSectionIds.length === 0) {
      return {
        items: [],
        pagination: buildPaginationMeta(page, limit, 0),
        teachersCanPublishAgenda: schoolCanPublish,
      };
    }

    const where: Prisma.AgendaWhereInput = {
      deletedAt: null,
      course: { schoolId: user.schoolId },
      sections: {
        some: {
          deletedAt: null,
          sectionId: { in: filterSectionIds },
        },
      },
      // Drafts (0) are private to the author; saved (2) + published (1) are shared.
      OR: [
        { status: { in: [AGENDA_STATUS.saved, AGENDA_STATUS.published] } },
        { status: AGENDA_STATUS.draft, personId: user.id },
      ],
      ...(query.agendaDate
        ? { agendaDate: parseDateOnly(query.agendaDate) }
        : query.month
          ? { agendaDate: monthDateRange(query.month) }
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
      items: rows.map((row) =>
        this.toItem(
          row,
          assignmentIds,
          user.id,
          schoolCanPublish,
          supervisedIds,
        ),
      ),
      pagination: buildPaginationMeta(page, limit, total),
      teachersCanPublishAgenda: schoolCanPublish,
    };
  }

  async createAgenda(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherAgendaDto,
  ): Promise<TeacherAgendaItemDto> {
    const assignment = await this.assertWritableAssignment(user, dto);
    const schoolCanPublish = await this.teachersCanPublishAgenda(user.schoolId);
    const status = this.resolveStatusFromDto(dto, AGENDA_STATUS.saved);
    if (status === AGENDA_STATUS.published) {
      const canPublish =
        schoolCanPublish ||
        (await this.teacherAccess.isSupervisorOfSection(
          user,
          assignment.sectionId,
        ));
      this.assertTeacherMayPublish(canPublish);
    }

    const created = await this.prisma.agenda.create({
      data: {
        title: dto.title.trim(),
        description: dto.description.trim(),
        agendaDate: parseDateOnly(dto.date),
        time: dto.time?.trim() || '08:00',
        personId: user.id,
        courseId: assignment.courseId,
        imageLink: dto.imageLink?.trim() || '',
        fileLink: normalizePublicMediaUrl(dto.fileLink) ?? '',
        publishedDate: new Date(),
        status,
        sections: { create: { sectionId: assignment.sectionId } },
      },
      include: agendaInclude,
    });

    await this.notifyParentsOfAgenda(created);
    if (created.status === AGENDA_STATUS.saved) {
      await this.notifySupervisorsOfSavedAgenda(created, user);
    }

    return this.toItem(
      created,
      new Map([[this.key(assignment.courseId, assignment.sectionId), assignment.id]]),
      user.id,
      schoolCanPublish,
      await this.teacherAccess.supervisedSectionIds(user),
    );
  }

  async getAgenda(
    user: AuthenticatedTeacher,
    agendaId: number,
  ): Promise<TeacherAgendaItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const sectionIds = await this.teacherAccess.taughtOrSupervisedSectionIds(
      user,
    );
    const row = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        deletedAt: null,
        course: { schoolId: user.schoolId },
        sections: {
          some: {
            deletedAt: null,
            sectionId: { in: sectionIds.length > 0 ? sectionIds : [-1] },
          },
        },
      },
      include: agendaInclude,
    });
    if (!row) {
      throw new NotFoundException('Agenda not found');
    }
    if (row.status === AGENDA_STATUS.draft && row.personId !== user.id) {
      throw new NotFoundException('Agenda not found');
    }

    const assignmentIds = await this.resolveAssignmentIds(user, [
      {
        courseId: row.courseId,
        sectionId: row.sections[0]?.section.id,
      },
    ]);
    const schoolCanPublish = await this.teachersCanPublishAgenda(user.schoolId);
    return this.toItem(
      row,
      assignmentIds,
      user.id,
      schoolCanPublish,
      await this.teacherAccess.supervisedSectionIds(user),
    );
  }

  async publishAgenda(
    user: AuthenticatedTeacher,
    agendaId: number,
  ): Promise<TeacherAgendaItemDto> {
    const row = await this.findPublishableAgenda(user, agendaId);
    const sectionId = row.sectionId;
    const schoolCanPublish = await this.teachersCanPublishAgenda(user.schoolId);
    const isSupervisor = await this.teacherAccess.isSupervisorOfSection(
      user,
      sectionId,
    );
    if (row.personId !== user.id && !isSupervisor) {
      throw new ForbiddenException('You cannot publish this agenda');
    }
    this.assertTeacherMayPublish(schoolCanPublish || isSupervisor);
    const published = await this.prisma.agenda.update({
      where: { id: agendaId },
      data: { status: AGENDA_STATUS.published, publishedDate: new Date() },
      include: agendaInclude,
    });
    const assignmentIds = await this.resolveAssignmentIds(user, [
      {
        courseId: published.courseId,
        sectionId: published.sections[0]?.section.id,
      },
    ]);
    await this.notifyParentsOfAgenda(published);
    if (published.personId !== user.id) {
      await this.notifyAuthorAgendaPublished(published);
    }
    return this.toItem(
      published,
      assignmentIds,
      user.id,
      schoolCanPublish,
      await this.teacherAccess.supervisedSectionIds(user),
    );
  }

  async updateAgenda(
    user: AuthenticatedTeacher,
    agendaId: number,
    dto: UpsertTeacherAgendaDto,
  ): Promise<TeacherAgendaItemDto> {
    const existing = await this.findOwnAgenda(user, agendaId);
    const assignment = await this.assertWritableAssignment(user, dto);
    const schoolCanPublish = await this.teachersCanPublishAgenda(user.schoolId);
    const nextStatus =
      dto.status !== undefined || dto.published !== undefined
        ? this.resolveStatusFromDto(dto, existing.status)
        : existing.status;
    if (
      nextStatus === AGENDA_STATUS.published &&
      existing.status !== AGENDA_STATUS.published
    ) {
      const canPublish =
        schoolCanPublish ||
        (await this.teacherAccess.isSupervisorOfSection(
          user,
          assignment.sectionId,
        ));
      this.assertTeacherMayPublish(canPublish);
    }

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
          imageLink: dto.imageLink?.trim() || '',
          fileLink: normalizePublicMediaUrl(dto.fileLink) ?? '',
          status: nextStatus,
          ...(nextStatus === AGENDA_STATUS.published &&
          existing.status !== AGENDA_STATUS.published
            ? { publishedDate: new Date() }
            : {}),
        },
        include: agendaInclude,
      });
    });

    if (updated.status === AGENDA_STATUS.published) {
      await this.notifyParentsOfAgenda(updated);
    } else if (
      updated.status === AGENDA_STATUS.saved &&
      existing.status === AGENDA_STATUS.draft
    ) {
      await this.notifySupervisorsOfSavedAgenda(updated, user);
    }

    return this.toItem(
      updated,
      new Map([[this.key(assignment.courseId, assignment.sectionId), assignment.id]]),
      user.id,
      schoolCanPublish,
      await this.teacherAccess.supervisedSectionIds(user),
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

  private async findPublishableAgenda(
    user: AuthenticatedTeacher,
    agendaId: number,
  ) {
    const row = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        deletedAt: null,
        course: { schoolId: user.schoolId },
      },
      select: {
        id: true,
        personId: true,
        status: true,
        sections: {
          where: { deletedAt: null },
          select: { sectionId: true },
          take: 1,
        },
      },
    });
    if (!row || !row.sections[0]) {
      throw new NotFoundException('Agenda not found');
    }
    return {
      id: row.id,
      personId: row.personId,
      status: row.status,
      sectionId: row.sections[0].sectionId,
    };
  }

  private async findOwnAgenda(user: AuthenticatedTeacher, agendaId: number) {
    const row = await this.prisma.agenda.findFirst({
      where: {
        id: agendaId,
        personId: user.id,
        deletedAt: null,
        course: { schoolId: user.schoolId },
      },
      select: { id: true, status: true },
    });
    if (!row) {
      throw new NotFoundException('Agenda not found');
    }
    return row;
  }

  private resolveStatusFromDto(
    dto: UpsertTeacherAgendaDto,
    fallback: number,
  ): number {
    if (dto.status) {
      return agendaStatusCode(dto.status);
    }
    if (dto.published === true) {
      return AGENDA_STATUS.published;
    }
    if (dto.published === false) {
      return AGENDA_STATUS.saved;
    }
    return fallback;
  }

  private async notifyParentsOfAgenda(row: AgendaRecord): Promise<void> {
    if (row.status !== AGENDA_STATUS.published) {
      return;
    }

    const sectionIds = row.sections.map((item) => item.section.id);
    if (sectionIds.length === 0) {
      return;
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        sectionId: { in: sectionIds },
        status: true,
      },
      select: { studentId: true },
    });
    const studentIds = registrations.map((item) => item.studentId);
    if (studentIds.length === 0) {
      return;
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds }, parentId: { not: null } },
      select: { parent: { select: { personId: true } } },
    });

    const personIds = students
      .map((student) => student.parent?.personId)
      .filter((id): id is number => id !== undefined);

    await this.parentFcmNotify.sendToPersonIds(
      personIds,
      row.title.trim() || row.course.title || 'Agenda',
      row.description,
      {
        type: 'agenda',
        route: 'agenda',
        agendaId: String(row.id),
      },
    );
  }

  private async notifySupervisorsOfSavedAgenda(
    row: AgendaRecord,
    author: AuthenticatedTeacher,
  ): Promise<void> {
    if (row.status !== AGENDA_STATUS.saved) {
      return;
    }

    const sectionId = row.sections[0]?.section.id;
    if (!sectionId) {
      return;
    }

    const supervisorPersonIds =
      await this.teacherAccess.supervisorPersonIdsForSection(
        author.schoolId,
        sectionId,
      );
    const personIds = supervisorPersonIds.filter((id) => id !== author.id);
    if (personIds.length === 0) {
      return;
    }

    const authorPerson = await this.prisma.person.findUnique({
      where: { id: author.id },
      select: { firstName: true, lastName: true },
    });
    const authorName =
      `${authorPerson?.firstName ?? ''} ${authorPerson?.lastName ?? ''}`.trim() ||
      'A teacher';
    const agendaTitle = row.title.trim() || row.course.title || 'Agenda';
    const classLabel = formatClassLabel(
      row.sections[0].section.class.className,
      row.sections[0].section.sectionTitle.title,
    );

    await this.parentFcmNotify.sendToPersonIds(
      personIds,
      'Agenda awaiting publish',
      `${authorName} saved an agenda for ${classLabel}: ${agendaTitle}`,
      {
        type: 'agenda',
        route: 'agenda',
        agendaId: String(row.id),
      },
    );
  }

  private async notifyAuthorAgendaPublished(row: AgendaRecord): Promise<void> {
    if (row.status !== AGENDA_STATUS.published) {
      return;
    }

    const title = row.title.trim() || row.course.title || 'Agenda';
    await this.parentFcmNotify.sendToPersonIds(
      [row.personId],
      'Agenda published',
      `Your agenda is now published: ${title}`,
      {
        type: 'agenda',
        route: 'agenda',
        agendaId: String(row.id),
      },
    );
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
    viewerPersonId: number,
    schoolCanPublish: boolean,
    supervisedSectionIds: number[],
  ): TeacherAgendaItemDto {
    const section = row.sections[0]?.section;
    if (!section) {
      throw new ForbiddenException('Agenda is missing a class');
    }
    const canPublish =
      schoolCanPublish || supervisedSectionIds.includes(section.id);

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
      imageLink: row.imageLink || null,
      fileLink: normalizePublicMediaUrl(row.fileLink),
      published: row.status === AGENDA_STATUS.published,
      status: agendaStatusLabel(row.status),
      isOwn: row.personId === viewerPersonId,
      canPublish,
    };
  }

  private async teachersCanPublishAgenda(schoolId: number): Promise<boolean> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { teachersCanPublishAgenda: true },
    });
    return school?.teachersCanPublishAgenda ?? true;
  }

  private assertTeacherMayPublish(canPublish: boolean): void {
    if (!canPublish) {
      throw new ForbiddenException(
        'The school publishes agendas. You can save drafts only.',
      );
    }
  }

  private key(courseId: number, sectionId: number): string {
    return `${sectionId}:${courseId}`;
  }
}

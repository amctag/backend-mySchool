import {
  BadRequestException,
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
  TeacherActivitiesQueryDto,
  TeacherActivitiesResponseDto,
  TeacherActivityItemDto,
  UpsertTeacherActivityDto,
} from './dto/teacher-media.dto';
import {
  formatClassLabel,
  formatDateOnly,
  parseDateOnly,
} from './teacher.util';
import { normalizePublicMediaUrl } from '../../upload/media-upload.service';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const activityInclude = {
  year: { select: { id: true, title: true, schoolId: true } },
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

type ActivityRecord = Prisma.ActivityGetPayload<{
  include: typeof activityInclude;
}>;

@Injectable()
export class TeacherActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
  ) {}

  async listActivities(
    user: AuthenticatedTeacher,
    query: TeacherActivitiesQueryDto,
  ): Promise<TeacherActivitiesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });
    const where = await this.buildWhere(user);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        include: activityInclude,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const assignmentIds = await this.resolveAssignmentIds(
      user,
      rows.map((row) => ({
        courseId: row.courseId ?? undefined,
        sectionId: row.sections[0]?.section.id,
      })),
    );

    return {
      items: rows.map((row) => this.toItem(row, assignmentIds, user.id)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getActivity(
    user: AuthenticatedTeacher,
    activityId: number,
  ): Promise<TeacherActivityItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const where = await this.buildWhere(user);
    const row = await this.prisma.activity.findFirst({
      where: { ...where, id: activityId },
      include: activityInclude,
    });
    if (!row) {
      throw new NotFoundException('Activity not found');
    }
    const assignmentIds = await this.resolveAssignmentIds(user, [
      {
        courseId: row.courseId ?? undefined,
        sectionId: row.sections[0]?.section.id,
      },
    ]);
    return this.toItem(row, assignmentIds, user.id);
  }

  async createActivity(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherActivityDto,
  ): Promise<TeacherActivityItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const assignment = await this.teacherAccess.getAssignment(
      user,
      dto.assignmentId,
    );
    if (assignment.sectionId !== dto.classId) {
      throw new BadRequestException(
        'classId does not match the teaching assignment',
      );
    }

    const created = await this.prisma.activity.create({
      data: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        date: dto.date ? parseDateOnly(dto.date) : parseDateOnly(formatDateOnly(new Date())),
        image: normalizePublicMediaUrl(dto.image) ?? '',
        personId: user.id,
        yearId: assignment.yearId,
        courseId: assignment.courseId,
        sections: {
          create: { sectionId: assignment.sectionId },
        },
      },
      include: activityInclude,
    });

    await this.notifyParentsOfActivity(created);

    return this.toItem(
      created,
      new Map([
        [
          this.key(assignment.courseId, assignment.sectionId),
          assignment.id,
        ],
      ]),
      user.id,
    );
  }

  private async buildWhere(
    user: AuthenticatedTeacher,
  ): Promise<Prisma.ActivityWhereInput> {
    const teaches = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
      },
      select: { yearId: true, sectionId: true },
    });
    const yearIds = [...new Set(teaches.map((row) => row.yearId))];
    const sectionIds = [...new Set(teaches.map((row) => row.sectionId))];

    return {
      deletedAt: null,
      OR: [
        ...(sectionIds.length > 0
          ? [
              {
                sections: {
                  some: {
                    deletedAt: null,
                    sectionId: { in: sectionIds },
                  },
                },
              },
            ]
          : []),
        ...(yearIds.length > 0
          ? [
              {
                sections: { none: { deletedAt: null } },
                year: { schoolId: user.schoolId },
                yearId: { in: yearIds },
              },
            ]
          : []),
        {
          sections: { none: { deletedAt: null } },
          yearId: null,
          person: { schoolId: user.schoolId },
        },
        {
          sections: { none: { deletedAt: null } },
          yearId: null,
          personId: DASHBOARD_CREATOR_PERSON_ID,
        },
      ],
    };
  }

  private async notifyParentsOfActivity(row: ActivityRecord): Promise<void> {
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
      row.title.trim() || 'Activity',
      row.content,
      {
        type: 'activity',
        route: 'activities',
        activityId: String(row.id),
      },
    );
  }

  private async resolveAssignmentIds(
    user: AuthenticatedTeacher,
    pairs: Array<{ courseId?: number; sectionId?: number }>,
  ) {
    const valid = pairs.filter(
      (pair): pair is { courseId: number; sectionId: number } =>
        pair.courseId !== undefined && pair.sectionId !== undefined,
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
    row: ActivityRecord,
    assignmentIds: Map<string, number>,
    viewerPersonId: number,
  ): TeacherActivityItemDto {
    const section = row.sections[0]?.section;
    const classLabel = section
      ? formatClassLabel(
          section.class.className,
          section.sectionTitle.title,
        )
      : null;
    const courseTitle = row.course?.title ?? null;
    const isSectionScoped = section != null;

    return {
      id: row.id,
      assignmentId:
        section && row.courseId
          ? (assignmentIds.get(this.key(row.courseId, section.id)) ?? 0)
          : 0,
      classId: section?.id ?? 0,
      title: row.title,
      content: row.content,
      date: formatDateOnly(row.date),
      image: row.image || '',
      isGlobal: !isSectionScoped && row.yearId == null,
      scopeLabel: isSectionScoped
        ? [classLabel, courseTitle].filter(Boolean).join(' · ')
        : row.year?.title || 'All school',
      classLabel,
      courseTitle,
      isOwn: row.personId === viewerPersonId,
    };
  }

  private key(courseId: number, sectionId: number): string {
    return `${sectionId}:${courseId}`;
  }
}

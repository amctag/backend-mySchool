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
          class: {
            select: {
              id: true,
              className: true,
              stage: { select: { id: true, title: true } },
            },
          },
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
    const target = await this.resolveActivityTarget(user, dto);

    const created = await this.prisma.activity.create({
      data: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        date: dto.date
          ? parseDateOnly(dto.date)
          : parseDateOnly(formatDateOnly(new Date())),
        image: normalizePublicMediaUrl(dto.image) ?? '',
        personId: user.id,
        yearId: target.yearId,
        courseId: target.courseId,
        sections: {
          create: target.sectionIds.map((sectionId) => ({ sectionId })),
        },
      },
      include: activityInclude,
    });

    await this.notifyParentsOfActivity(created);

    return this.toItem(
      created,
      target.courseId != null
        ? new Map([
            [
              this.key(target.courseId, target.sectionIds[0]),
              target.assignmentId,
            ],
          ])
        : new Map(),
      user.id,
    );
  }

  private async resolveActivityTarget(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherActivityDto,
  ): Promise<{
    yearId: number;
    courseId: number | null;
    sectionIds: number[];
    assignmentId: number;
  }> {
    const scope = dto.scopeType ?? 'section_course';

    if (scope === 'section_course') {
      if (dto.assignmentId == null || dto.classId == null) {
        throw new BadRequestException(
          'assignmentId and classId are required for section_course scope',
        );
      }
      const assignment = await this.teacherAccess.getAssignment(
        user,
        dto.assignmentId,
      );
      if (assignment.sectionId !== dto.classId) {
        throw new BadRequestException(
          'classId does not match the teaching assignment',
        );
      }
      return {
        yearId: assignment.yearId,
        courseId: assignment.courseId,
        sectionIds: [assignment.sectionId],
        assignmentId: assignment.id,
      };
    }

    if (scope === 'section') {
      if (dto.classId == null) {
        throw new BadRequestException(
          'classId is required for section scope',
        );
      }
      await this.teacherAccess.assertAssignedSection(user, dto.classId);
      const teach = await this.prisma.teach.findFirst({
        where: {
          teacherId: user.teacherId,
          sectionId: dto.classId,
          section: { schoolId: user.schoolId },
        },
        select: { id: true, yearId: true, sectionId: true },
        orderBy: { id: 'asc' },
      });
      if (!teach) {
        throw new BadRequestException(
          'No teaching assignment found for this section',
        );
      }
      return {
        yearId: teach.yearId,
        courseId: null,
        sectionIds: [teach.sectionId],
        assignmentId: teach.id,
      };
    }

    const yearId = await this.teacherAccess.currentYearId(user.schoolId);

    if (scope === 'class') {
      if (dto.schoolClassId == null) {
        throw new BadRequestException(
          'schoolClassId is required for class scope',
        );
      }
      const teaches = await this.prisma.teach.findMany({
        where: {
          teacherId: user.teacherId,
          section: {
            schoolId: user.schoolId,
            classId: dto.schoolClassId,
          },
          ...(yearId ? { yearId } : {}),
        },
        select: { id: true, yearId: true, sectionId: true },
        orderBy: { id: 'asc' },
      });
      const sectionIds = [
        ...new Set(teaches.map((row) => row.sectionId)),
      ];
      if (sectionIds.length === 0) {
        throw new BadRequestException(
          'No assigned sections found for this class',
        );
      }
      return {
        yearId: teaches[0].yearId,
        courseId: null,
        sectionIds,
        assignmentId: teaches[0].id,
      };
    }

    if (dto.stageId == null) {
      throw new BadRequestException('stageId is required for stage scope');
    }
    const teaches = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: {
          schoolId: user.schoolId,
          class: { stageId: dto.stageId },
        },
        ...(yearId ? { yearId } : {}),
      },
      select: { id: true, yearId: true, sectionId: true },
      orderBy: { id: 'asc' },
    });
    const sectionIds = [...new Set(teaches.map((row) => row.sectionId))];
    if (sectionIds.length === 0) {
      throw new BadRequestException(
        'No assigned sections found for this stage',
      );
    }
    return {
      yearId: teaches[0].yearId,
      courseId: null,
      sectionIds,
      assignmentId: teaches[0].id,
    };
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
    const sections = row.sections.map((item) => item.section);
    const section = sections[0];
    const courseTitle = row.course?.title ?? null;
    const isSectionScoped = sections.length > 0;
    const classLabel =
      sections.length === 1
        ? formatClassLabel(
            section.class.className,
            section.sectionTitle.title,
          )
        : sections.length > 1
          ? this.multiSectionClassLabel(sections)
          : null;

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

  private multiSectionClassLabel(
    sections: Array<{
      class: { className: string; stage: { title: string } };
      sectionTitle: { title: string };
    }>,
  ): string {
    const classNames = [
      ...new Set(sections.map((item) => item.class.className)),
    ];
    const stageTitles = [
      ...new Set(sections.map((item) => item.class.stage.title)),
    ];
    if (classNames.length === 1) {
      return `${classNames[0]} · ${sections.length} sections`;
    }
    if (stageTitles.length === 1) {
      return `${stageTitles[0]} · ${sections.length} sections`;
    }
    return `${sections.length} sections`;
  }

  private key(courseId: number, sectionId: number): string {
    return `${sectionId}:${courseId}`;
  }
}

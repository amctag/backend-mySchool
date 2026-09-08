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
import { TeacherMessageResponseDto } from './dto/teacher-auth.dto';
import {
  TeacherNoticeItemDto,
  TeacherNoticesQueryDto,
  TeacherNoticesResponseDto,
  UpsertTeacherNoticeDto,
} from './dto/teacher-notices.dto';
import {
  formatClassLabel,
  formatDateOnly,
  formatFullName,
  parseDateOnly,
} from './teacher.util';

const noticeInclude = {
  person: {
    select: { firstName: true, middleName: true, lastName: true },
  },
  students: {
    where: { deletedAt: null },
    include: {
      student: {
        select: {
          id: true,
          person: {
            select: { firstName: true, middleName: true, lastName: true },
          },
        },
      },
    },
  },
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

type NoticeRecord = Prisma.NoticeGetPayload<{ include: typeof noticeInclude }>;

@Injectable()
export class TeacherNoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
  ) {}

  async listNotices(
    user: AuthenticatedTeacher,
    query: TeacherNoticesQueryDto,
  ): Promise<TeacherNoticesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination(query);

    const where: Prisma.NoticeWhereInput = {
      deletedAt: null,
      personId: user.id,
      schoolId: user.schoolId,
      ...(query.classId
        ? {
            OR: [
              { sections: { some: { deletedAt: null, sectionId: query.classId } } },
              {
                students: {
                  some: {
                    deletedAt: null,
                    student: {
                      registrations: {
                        some: {
                          status: true,
                          sectionId: query.classId,
                          schoolId: user.schoolId,
                        },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        include: noticeInclude,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    const assignmentIds = await this.resolveAssignmentIds(
      user,
      rows.map((row) => this.sectionIdOf(row)).filter((id): id is number => id !== null),
    );

    return {
      items: rows.map((row) => this.toItem(row, assignmentIds)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async createNotice(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherNoticeDto,
  ): Promise<TeacherNoticeItemDto> {
    const context = await this.assertWritableTarget(user, dto);

    const created = await this.prisma.notice.create({
      data: {
        schoolId: user.schoolId,
        title: dto.title.trim(),
        description: dto.content.trim(),
        personId: user.id,
        date: parseDateOnly(dto.publishDate),
        status: true,
        sections: { create: { sectionId: context.sectionId } },
        ...(dto.targetType === 'student'
          ? { students: { create: { studentId: dto.targetId } } }
          : {}),
      },
      include: noticeInclude,
    });

    await this.notifyParents(created);

    const assignmentIds = await this.resolveAssignmentIds(user, [
      context.sectionId,
    ]);
    return this.toItem(created, assignmentIds);
  }

  async updateNotice(
    user: AuthenticatedTeacher,
    noticeId: number,
    dto: UpsertTeacherNoticeDto,
  ): Promise<TeacherNoticeItemDto> {
    await this.findOwnNotice(user, noticeId);
    const context = await this.assertWritableTarget(user, dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.noticeStudent.deleteMany({ where: { noticeId } });
      await tx.noticeSection.deleteMany({ where: { noticeId } });

      await tx.noticeSection.create({
        data: { noticeId, sectionId: context.sectionId },
      });
      if (dto.targetType === 'student') {
        await tx.noticeStudent.create({
          data: { noticeId, studentId: dto.targetId },
        });
      }

      return tx.notice.update({
        where: { id: noticeId },
        data: {
          title: dto.title.trim(),
          description: dto.content.trim(),
          date: parseDateOnly(dto.publishDate),
        },
        include: noticeInclude,
      });
    });

    const assignmentIds = await this.resolveAssignmentIds(user, [
      context.sectionId,
    ]);
    return this.toItem(updated, assignmentIds);
  }

  async deleteNotice(
    user: AuthenticatedTeacher,
    noticeId: number,
  ): Promise<TeacherMessageResponseDto> {
    await this.findOwnNotice(user, noticeId);
    await this.prisma.notice.update({
      where: { id: noticeId },
      data: { deletedAt: new Date(), status: false },
    });
    return { message: 'Notice deleted successfully' };
  }

  private async findOwnNotice(user: AuthenticatedTeacher, noticeId: number) {
    const row = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        personId: user.id,
        schoolId: user.schoolId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Notice not found');
    }
  }

  private async assertWritableTarget(
    user: AuthenticatedTeacher,
    dto: UpsertTeacherNoticeDto,
  ) {
    this.teacherAccess.ensureTeacherRole(user);

    if (dto.assignmentId) {
      const assignment = await this.teacherAccess.getAssignment(
        user,
        dto.assignmentId,
      );
      if (assignment.sectionId !== dto.classId) {
        throw new BadRequestException(
          'classId does not match the teaching assignment',
        );
      }
    }

    await this.teacherAccess.assertAssignedSection(user, dto.classId);

    if (dto.targetType === 'section') {
      if (dto.targetId !== dto.classId) {
        throw new BadRequestException(
          'targetId must match classId for section notices',
        );
      }
      return { sectionId: dto.classId };
    }

    const registration = await this.prisma.registration.findFirst({
      where: {
        studentId: dto.targetId,
        sectionId: dto.classId,
        schoolId: user.schoolId,
        status: true,
      },
      select: { id: true },
    });

    if (!registration) {
      throw new BadRequestException(
        'Student is not registered in this class',
      );
    }

    return { sectionId: dto.classId };
  }

  private async resolveAssignmentIds(
    user: AuthenticatedTeacher,
    sectionIds: number[],
  ) {
    const unique = [...new Set(sectionIds)];
    if (unique.length === 0) {
      return new Map<number, number>();
    }

    const rows = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        sectionId: { in: unique },
      },
      select: { id: true, sectionId: true },
      orderBy: { id: 'asc' },
    });

    const map = new Map<number, number>();
    for (const row of rows) {
      if (!map.has(row.sectionId)) {
        map.set(row.sectionId, row.id);
      }
    }
    return map;
  }

  private toItem(
    row: NoticeRecord,
    assignmentIds: Map<number, number>,
  ): TeacherNoticeItemDto {
    const student = row.students[0]?.student;
    const section = row.sections[0]?.section;
    const targetType: 'student' | 'section' = student ? 'student' : 'section';
    const classId = section?.id ?? 0;
    const classLabel = section
      ? formatClassLabel(section.class.className, section.sectionTitle.title)
      : '';

    return {
      id: row.id,
      assignmentId: classId ? assignmentIds.get(classId) ?? null : null,
      classId: classId ?? 0,
      targetType,
      targetId: student?.id ?? section?.id ?? 0,
      targetLabel: student
        ? formatFullName(student.person)
        : section
          ? `Section ${section.sectionTitle.title}`
          : '',
      classLabel,
      title: row.title || 'Notice',
      content: row.description,
      creator: formatFullName(row.person),
      publishDate: formatDateOnly(row.date),
    };
  }

  private sectionIdOf(row: NoticeRecord): number | null {
    return row.sections[0]?.section.id ?? null;
  }

  private async notifyParents(notice: NoticeRecord): Promise<void> {
    const studentIds = notice.students.map((item) => item.student.id);
    let targetStudentIds = studentIds;

    if (studentIds.length === 0 && notice.sections[0]) {
      const registrations = await this.prisma.registration.findMany({
        where: {
          sectionId: notice.sections[0].section.id,
          status: true,
        },
        select: { studentId: true },
      });
      targetStudentIds = registrations.map((row) => row.studentId);
    }

    if (targetStudentIds.length === 0) {
      return;
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: targetStudentIds }, parentId: { not: null } },
      select: { parent: { select: { personId: true } } },
    });

    const personIds = students
      .map((student) => student.parent?.personId)
      .filter((id): id is number => id !== undefined);

    await this.parentFcmNotify.sendToPersonIds(
      personIds,
      notice.title.trim() || 'Notice',
      notice.description,
      { type: 'notice', noticeId: String(notice.id) },
    );
  }
}

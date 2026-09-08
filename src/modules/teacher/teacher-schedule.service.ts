import { Injectable } from '@nestjs/common';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  assignmentInclude,
  TeacherAccessService,
} from './teacher-access.service';
import {
  TeacherAssignmentItemDto,
  TeacherAssignmentsQueryDto,
  TeacherAssignmentsResponseDto,
  TeacherScheduleEntryDto,
  TeacherScheduleResponseDto,
} from './dto/teacher-schedule.dto';
import {
  formatClassLabel,
  formatFullName,
  periodClock,
} from './teacher.util';

@Injectable()
export class TeacherScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async getSchedule(
    user: AuthenticatedTeacher,
    yearId?: number,
  ): Promise<TeacherScheduleResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const [person, days, assignments] = await Promise.all([
      this.prisma.person.findFirst({
        where: { id: user.id },
        select: { firstName: true, middleName: true, lastName: true },
      }),
      this.prisma.day.findMany({
        where: { schoolId: user.schoolId },
        select: { id: true, dayName: true, position: true },
        orderBy: { position: 'asc' },
      }),
      this.prisma.teach.findMany({
        where: {
          teacherId: user.teacherId,
          section: {
            schoolId: user.schoolId,
            ...(yearId
              ? { yearId }
              : { year: { isCurrent: true } }),
          },
          ...(yearId ? { yearId } : {}),
        },
        select: {
          id: true,
          sectionId: true,
          courseId: true,
          section: {
            select: {
              class: { select: { className: true } },
              sectionTitle: { select: { title: true } },
            },
          },
        },
      }),
    ]);

    const assignmentByKey = new Map(
      assignments.map((row) => [
        this.assignmentKey(row.sectionId, row.courseId),
        row,
      ]),
    );
    const sectionIds = [...new Set(assignments.map((row) => row.sectionId))];
    const courseIds = [...new Set(assignments.map((row) => row.courseId))];

    const details =
      sectionIds.length === 0 || courseIds.length === 0
        ? []
        : await this.prisma.weeklyScheduleDetail.findMany({
            where: {
              courseId: { in: courseIds },
              schedule: {
                sectionId: { in: sectionIds },
                section: { schoolId: user.schoolId },
              },
            },
            select: {
              note: true,
              courseId: true,
              personId: true,
              course: { select: { title: true } },
              day: { select: { id: true } },
              session: { select: { sessionName: true, position: true } },
              schedule: { select: { sectionId: true } },
            },
          });

    const entriesByDay = new Map<number, TeacherScheduleEntryDto[]>();
    for (const detail of details) {
      const assignment = assignmentByKey.get(
        this.assignmentKey(detail.schedule.sectionId, detail.courseId),
      );
      if (!assignment) {
        continue;
      }
      if (detail.personId != null && detail.personId !== user.id) {
        continue;
      }

      const clock = periodClock(detail.session.position);
      const bucket = entriesByDay.get(detail.day.id) ?? [];
      bucket.push({
        assignmentId: assignment.id,
        classId: assignment.sectionId,
        classLabel: formatClassLabel(
          assignment.section.class.className,
          assignment.section.sectionTitle.title,
        ),
        courseTitle: detail.course.title,
        periodNumber: Math.max(1, detail.session.position),
        periodLabel: detail.session.sessionName,
        startTime: clock.startTime,
        endTime: clock.endTime,
        room: detail.note?.trim() || '',
      });
      entriesByDay.set(detail.day.id, bucket);
    }

    const mappedDays = days.map((day) => ({
      dayName: day.dayName,
      position: day.position,
      entries: (entriesByDay.get(day.id) ?? []).sort(
        (left, right) => left.periodNumber - right.periodNumber,
      ),
    }));
    const hasLessons = mappedDays.some((day) => day.entries.length > 0);

    return {
      ownerLabel: person ? formatFullName(person) : user.username,
      days: hasLessons ? mappedDays : [],
    };
  }

  async listAssignments(
    user: AuthenticatedTeacher,
    query: TeacherAssignmentsQueryDto,
  ): Promise<TeacherAssignmentsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const yearId = await this.teacherAccess.currentYearId(user.schoolId);
    const { page, limit, skip } = resolvePagination(query);
    const where = {
      teacherId: user.teacherId,
      section: { schoolId: user.schoolId },
      ...(yearId ? { yearId } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.teach.count({ where }),
      this.prisma.teach.findMany({
        where,
        include: assignmentInclude,
        orderBy: [{ id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    const slotByKey = await this.loadScheduleSlots(
      user,
      rows.map((row) => ({
        sectionId: row.sectionId,
        courseId: row.courseId,
      })),
    );

    return {
      items: rows.map((row) => this.toAssignmentItem(row, slotByKey)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  private toAssignmentItem(
    row: {
      id: number;
      sectionId: number;
      courseId: number;
      course: { title: string };
      year: { title: string };
      section: {
        class: { className: string; stage: { title: string } };
        sectionTitle: { title: string };
      };
    },
    slotByKey: Map<
      string,
      { dayName: string; periodNumber: number; periodLabel: string; room: string }
    >,
  ): TeacherAssignmentItemDto {
    const mapped = slotByKey.get(
      this.assignmentKey(row.sectionId, row.courseId),
    );
    const clock = periodClock(mapped?.periodNumber ?? 1);

    return {
      id: row.id,
      classId: row.sectionId,
      className: row.section.class.className,
      sectionTitle: row.section.sectionTitle.title,
      yearTitle: row.year.title,
      stage: row.section.class.stage.title,
      courseTitle: row.course.title,
      dayName: mapped?.dayName ?? '',
      periodNumber: mapped?.periodNumber ?? 0,
      periodLabel: mapped?.periodLabel ?? '',
      startTime: mapped ? clock.startTime : '',
      endTime: mapped ? clock.endTime : '',
      room: mapped?.room ?? '',
    };
  }

  private async loadScheduleSlots(
    user: AuthenticatedTeacher,
    pairs: Array<{ sectionId: number; courseId: number }>,
  ) {
    const map = new Map<
      string,
      { dayName: string; periodNumber: number; periodLabel: string; room: string }
    >();
    if (pairs.length === 0) {
      return map;
    }

    const details = await this.prisma.weeklyScheduleDetail.findMany({
      where: {
        personId: user.id,
        OR: pairs.map((pair) => ({
          courseId: pair.courseId,
          schedule: { sectionId: pair.sectionId },
        })),
      },
      select: {
        courseId: true,
        note: true,
        day: { select: { dayName: true, position: true } },
        session: { select: { sessionName: true, position: true } },
        schedule: { select: { sectionId: true } },
      },
      orderBy: { id: 'asc' },
    });

    for (const detail of details) {
      const key = this.assignmentKey(detail.schedule.sectionId, detail.courseId);
      if (!map.has(key)) {
        map.set(key, {
          dayName: detail.day.dayName,
          periodNumber: Math.max(1, detail.session.position),
          periodLabel: detail.session.sessionName,
          room: detail.note?.trim() || '',
        });
      }
    }

    return map;
  }

  private assignmentKey(sectionId: number, courseId: number): string {
    return `${sectionId}:${courseId}`;
  }
}

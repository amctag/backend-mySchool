import { Injectable } from '@nestjs/common';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  TeacherClassDetailsResponseDto,
  TeacherClassRosterEntryDto,
  TeacherClassesQueryDto,
  TeacherClassesResponseDto,
  TeacherClassSummaryDto,
  TeacherStudentSummaryDto,
} from './dto/teacher-classes.dto';
import { formatClassLabel, formatFullName, periodClock } from './teacher.util';

@Injectable()
export class TeacherClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listAssignedClasses(
    user: AuthenticatedTeacher,
    query: TeacherClassesQueryDto,
  ): Promise<TeacherClassesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const yearId = await this.teacherAccess.currentYearId(user.schoolId);
    return this.listSections(user, query, true, yearId);
  }

  async listAllClassSchedules(
    user: AuthenticatedTeacher,
    query: TeacherClassesQueryDto,
  ): Promise<TeacherClassesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const yearId = await this.teacherAccess.currentYearId(user.schoolId);
    return this.listSections(user, query, false, yearId);
  }

  async getClassDetails(
    user: AuthenticatedTeacher,
    classId: number,
  ): Promise<TeacherClassDetailsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const section = await this.teacherAccess.findSectionInSchool(
      user.schoolId,
      classId,
    );
    const yearId = await this.teacherAccess.currentYearId(user.schoolId);

    const [assignedTeach, primaryTeach, registrations, rosterRows, days, details, assignmentRows] =
      await Promise.all([
        this.prisma.teach.findFirst({
          where: {
            teacherId: user.teacherId,
            sectionId: classId,
            ...(yearId ? { yearId } : {}),
          },
          include: { course: { select: { title: true } } },
          orderBy: { id: 'asc' },
        }),
        this.prisma.teach.findFirst({
          where: {
            sectionId: classId,
            ...(yearId ? { yearId } : {}),
          },
          include: { course: { select: { title: true } } },
          orderBy: { id: 'asc' },
        }),
        this.prisma.registration.findMany({
          where: { sectionId: classId, schoolId: user.schoolId, status: true },
          select: {
            student: {
              select: {
                id: true,
                person: {
                  select: {
                    firstName: true,
                    middleName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: [
            { student: { person: { firstName: 'asc' } } },
            { student: { person: { lastName: 'asc' } } },
            { id: 'asc' },
          ],
        }),
        this.prisma.teach.findMany({
          where: {
            sectionId: classId,
            ...(yearId ? { yearId } : {}),
          },
          select: {
            teacherId: true,
            course: { select: { title: true } },
            teacher: {
              select: {
                person: {
                  select: {
                    firstName: true,
                    middleName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        }),
        this.prisma.day.findMany({
          where: { schoolId: user.schoolId },
          select: { id: true, dayName: true, position: true },
          orderBy: { position: 'asc' },
        }),
        this.prisma.weeklyScheduleDetail.findMany({
          where: { schedule: { sectionId: classId } },
          select: {
            note: true,
            course: { select: { id: true, title: true } },
            day: { select: { id: true } },
            session: { select: { sessionName: true, position: true } },
          },
        }),
        this.prisma.teach.findMany({
          where: {
            teacherId: user.teacherId,
            sectionId: classId,
          },
          select: { id: true, courseId: true },
        }),
      ]);

    const assignmentByCourse = new Map(
      assignmentRows.map((row) => [row.courseId, row.id]),
    );

    const entriesByDay = new Map<number, typeof details>();
    for (const detail of details) {
      const bucket = entriesByDay.get(detail.day.id) ?? [];
      bucket.push(detail);
      entriesByDay.set(detail.day.id, bucket);
    }

    const summary: TeacherClassSummaryDto = {
      id: section.id,
      className: section.class.className,
      sectionTitle: section.sectionTitle.title,
      yearTitle: section.year.title,
      stage: section.class.stage.title,
      primaryCourseTitle:
        assignedTeach?.course.title ?? primaryTeach?.course.title ?? '',
      isAssignedToCurrentTeacher: Boolean(assignedTeach),
    };

    const students: TeacherStudentSummaryDto[] = registrations.map(
      (registration, index) => ({
        id: registration.student.id,
        fullName: formatFullName(registration.student.person),
        seatNumber: index + 1,
      }),
    );

    const roster: TeacherClassRosterEntryDto[] = rosterRows.map((row) => ({
      teacherName: formatFullName(row.teacher.person),
      courseTitle: row.course.title,
      isCurrentTeacher: row.teacherId === user.teacherId,
    }));

    return {
      summary,
      students,
      schedule: {
        ownerLabel: summary.className,
        days: days.map((day) => ({
          dayName: day.dayName,
          position: day.position,
          entries: (entriesByDay.get(day.id) ?? [])
            .map((detail) => {
              const clock = periodClock(detail.session.position);
              return {
                assignmentId: assignmentByCourse.get(detail.course.id) ?? 0,
                classId: classId,
                classLabel: formatClassLabel(
                  section.class.className,
                  section.sectionTitle.title,
                ),
                courseTitle: detail.course.title,
                periodNumber: Math.max(1, detail.session.position),
                periodLabel: detail.session.sessionName,
                startTime: clock.startTime,
                endTime: clock.endTime,
                room: detail.note?.trim() || '',
              };
            })
            .sort((left, right) => left.periodNumber - right.periodNumber),
        })),
      },
      roster,
    };
  }

  private async listSections(
    user: AuthenticatedTeacher,
    query: TeacherClassesQueryDto,
    assignedOnly: boolean,
    yearId: number | null,
  ): Promise<TeacherClassesResponseDto> {
    const { page, limit, skip } = resolvePagination(query);
    const where = {
      schoolId: user.schoolId,
      ...(yearId ? { yearId } : {}),
      ...(assignedOnly
        ? { teaches: { some: { teacherId: user.teacherId } } }
        : {}),
    };

    const [total, sections] = await this.prisma.$transaction([
      this.prisma.section.count({ where }),
      this.prisma.section.findMany({
        where,
        select: {
          id: true,
          class: {
            select: {
              className: true,
              stage: { select: { title: true } },
            },
          },
          sectionTitle: { select: { title: true } },
          year: { select: { title: true } },
          teaches: {
            where: yearId ? { yearId } : undefined,
            select: {
              teacherId: true,
              course: { select: { title: true } },
            },
            orderBy: { id: 'asc' },
          },
        },
        orderBy: [{ class: { className: 'asc' } }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: sections.map((section) => {
        const assigned = section.teaches.find(
          (teach) => teach.teacherId === user.teacherId,
        );
        return {
          id: section.id,
          className: section.class.className,
          sectionTitle: section.sectionTitle.title,
          yearTitle: section.year.title,
          stage: section.class.stage.title,
          primaryCourseTitle:
            assigned?.course.title ?? section.teaches[0]?.course.title ?? '',
          isAssignedToCurrentTeacher: Boolean(assigned),
        };
      }),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }
}

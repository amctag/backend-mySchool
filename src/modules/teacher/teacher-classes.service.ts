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
  TeacherClassStudentsResponseDto,
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
    const yearId =
      query.yearId ?? (await this.teacherAccess.currentYearId(user.schoolId));
    return this.listSections(user, query, true, yearId);
  }

  async listAllClassSchedules(
    user: AuthenticatedTeacher,
    query: TeacherClassesQueryDto,
  ): Promise<TeacherClassesResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const yearId =
      query.yearId ?? (await this.teacherAccess.currentYearId(user.schoolId));
    return this.listSections(user, query, false, yearId);
  }

  async listClassStudents(
    user: AuthenticatedTeacher,
    classId: number,
  ): Promise<TeacherClassStudentsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const yearId = await this.teacherAccess.currentYearId(user.schoolId);
    await this.teacherAccess.assertAssignedSection(user, classId, yearId);

    const section = await this.teacherAccess.findSectionInSchool(
      user.schoolId,
      classId,
    );
    const students = await this.loadStudents(user.schoolId, classId);

    return {
      classId,
      classLabel: formatClassLabel(
        section.class.className,
        section.sectionTitle.title,
      ),
      studentCount: students.length,
      students,
    };
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

    const [assignedTeaches, primaryTeach, students, rosterRows, days, details, assignmentRows] =
      await Promise.all([
        this.prisma.teach.findMany({
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
        this.loadStudents(user.schoolId, classId),
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

    const courseTitles = assignedTeaches.map((row) => row.course.title);
    const summary: TeacherClassSummaryDto = {
      id: section.id,
      className: section.class.className,
      sectionTitle: section.sectionTitle.title,
      yearTitle: section.year.title,
      stage: section.class.stage.title,
      primaryCourseTitle:
        courseTitles.join(', ') || primaryTeach?.course.title || '',
      courseTitles,
      studentCount: students.length,
      isAssignedToCurrentTeacher: assignedTeaches.length > 0,
    };

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
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 100,
    });
    const teachFilter = {
      teacherId: user.teacherId,
      ...(yearId ? { yearId } : {}),
    };
    const where = {
      schoolId: user.schoolId,
      ...(yearId ? { yearId } : {}),
      ...(assignedOnly ? { teaches: { some: teachFilter } } : {}),
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
          _count: {
            select: {
              registrations: { where: { status: true } },
            },
          },
        },
        orderBy: [{ class: { className: 'asc' } }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: sections.map((section) => {
        const assigned = section.teaches.filter(
          (teach) => teach.teacherId === user.teacherId,
        );
        const courseTitles = assigned.map((teach) => teach.course.title);
        return {
          id: section.id,
          className: section.class.className,
          sectionTitle: section.sectionTitle.title,
          yearTitle: section.year.title,
          stage: section.class.stage.title,
          primaryCourseTitle:
            courseTitles.join(', ') || section.teaches[0]?.course.title || '',
          courseTitles,
          studentCount: section._count.registrations,
          isAssignedToCurrentTeacher: assigned.length > 0,
        };
      }),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  private async loadStudents(
    schoolId: number,
    classId: number,
  ): Promise<TeacherStudentSummaryDto[]> {
    const registrations = await this.prisma.registration.findMany({
      where: { sectionId: classId, schoolId, status: true },
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
    });

    return registrations.map((registration, index) => ({
      id: registration.student.id,
      fullName: formatFullName(registration.student.person),
      seatNumber: index + 1,
    }));
  }
}

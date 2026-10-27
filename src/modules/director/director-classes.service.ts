import { Injectable } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  DirectorClassSummaryDto,
  DirectorClassesQueryDto,
  DirectorClassesResponseDto,
  DirectorClassStudentsResponseDto,
  DirectorClassDetailsResponseDto,
} from './dto/director-classes.dto';
import { formatFullName, formatClassLabel } from './director.util';

@Injectable()
export class DirectorClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listMyClasses(
    user: AuthenticatedDirector,
    query: DirectorClassesQueryDto,
  ): Promise<DirectorClassesResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);
    const yearId =
      query.yearId ?? (await this.directorAccess.currentYearId(user.schoolId));
    const { total, sections } = await this.directorAccess.listSectionsInSchool(
      user.schoolId,
      yearId,
    );
    const { page, limit } = resolvePagination({ page: query.page, limit: query.limit });

    // Load teaches records for all sections to get course titles
    const sectionIds = sections.map((s) => s.id);
    const teaches = await this.prisma.teach.findMany({
      where: {
        sectionId: { in: sectionIds },
        ...(yearId ? { yearId } : {}),
      },
      select: {
        sectionId: true,
        course: { select: { id: true, title: true } },
      },
      orderBy: { id: 'asc' },
    });

    // Build a map of sectionId -> course titles
    const courseMap = new Map<number, string[]>();
    teaches.forEach((t) => {
      if (!courseMap.has(t.sectionId)) {
        courseMap.set(t.sectionId, []);
      }
      const titles = courseMap.get(t.sectionId)!;
      if (!titles.includes(t.course.title)) {
        titles.push(t.course.title);
      }
    });

    return {
      items: sections.map((section) => ({
        id: section.id,
        className: section.class.className,
        sectionTitle: section.sectionTitle.title,
        yearTitle: section.year.title,
        stage: section.class.stage.title,
        primaryCourseTitle:
          courseMap.get(section.id)?.join(', ') ?? '',
        courseTitles: courseMap.get(section.id) ?? [],
        studentCount: section._count.registrations,
        isAssignedToCurrentDirector: true,
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async listClassSchedules(
    user: AuthenticatedDirector,
    query: DirectorClassesQueryDto,
  ): Promise<DirectorClassesResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);
    const yearId =
      query.yearId ?? (await this.directorAccess.currentYearId(user.schoolId));
    const { total, sections } = await this.directorAccess.listSectionsInSchool(
      user.schoolId,
      yearId,
    );
    const { page, limit } = resolvePagination({ page: query.page, limit: query.limit });

    // Load teaches records for all sections to get course titles
    const sectionIds = sections.map((s) => s.id);
    const teaches = await this.prisma.teach.findMany({
      where: {
        sectionId: { in: sectionIds },
        ...(yearId ? { yearId } : {}),
      },
      select: {
        sectionId: true,
        course: { select: { id: true, title: true } },
      },
      orderBy: { id: 'asc' },
    });

    // Build a map of sectionId -> course titles
    const courseMap = new Map<number, string[]>();
    teaches.forEach((t) => {
      if (!courseMap.has(t.sectionId)) {
        courseMap.set(t.sectionId, []);
      }
      const titles = courseMap.get(t.sectionId)!;
      if (!titles.includes(t.course.title)) {
        titles.push(t.course.title);
      }
    });

    return {
      items: sections.map((section) => ({
        id: section.id,
        className: section.class.className,
        sectionTitle: section.sectionTitle.title,
        yearTitle: section.year.title,
        stage: section.class.stage.title,
        primaryCourseTitle:
          courseMap.get(section.id)?.join(', ') ?? '',
        courseTitles: courseMap.get(section.id) ?? [],
        studentCount: section._count.registrations,
        isAssignedToCurrentDirector: true,
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async listClassStudents(
    user: AuthenticatedDirector,
    classId: number,
  ): Promise<DirectorClassStudentsResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    // Verify the class belongs to the director's school
    await this.directorAccess.assertSectionInSchool(user.schoolId, classId);

    const { students, studentCount } = await this.directorAccess.listStudentsInSection(
      user.schoolId,
      classId,
    );

    const section = await this.directorAccess.resolveSectionInSchool(
      user.schoolId,
      classId,
    );

    return {
      classId,
      classLabel: formatClassLabel(
        section.class.className,
        section.sectionTitle.title,
      ),
      studentCount,
      students,
    };
  }

  async getClassDetails(
    user: AuthenticatedDirector,
    classId: number,
  ): Promise<DirectorClassDetailsResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    // Verify the class belongs to the director's school
    const section = await this.directorAccess.resolveSectionInSchool(
      user.schoolId,
      classId,
    );

    const yearId = await this.directorAccess.currentYearId(user.schoolId);

    // Load all students in this section
    const { students, studentCount } = await this.directorAccess.listStudentsInSection(
      user.schoolId,
      classId,
    );

    // Load teaches records for this section (all teachers assigned to this class)
    const teaches = await this.prisma.teach.findMany({
      where: {
        sectionId: classId,
        ...(yearId ? { yearId } : {}),
      },
      select: {
        teacherId: true,
        course: { select: { id: true, title: true } },
        year: { select: { title: true } },
      },
      orderBy: { id: 'asc' },
    });

    // Load weekly schedule details
    const scheduleDetails = await this.prisma.weeklyScheduleDetail.findMany({
      where: { schedule: { sectionId: classId } },
      select: {
        note: true,
        course: { select: { id: true, title: true } },
        day: { select: { id: true, dayName: true, position: true } },
        session: { select: { sessionName: true, position: true } },
      },
      orderBy: [{ day: { position: 'asc' } }, { session: { position: 'asc' } }],
    });

    // Group schedule by day
    const entriesByDay = new Map<number, any[]>();
    for (const detail of scheduleDetails) {
      const bucket = entriesByDay.get(detail.day.id) ?? [];
      bucket.push({
        courseTitle: detail.course.title,
        periodNumber: detail.session.position,
        periodLabel: detail.session.sessionName,
        startTime: '',
        endTime: '',
        room: detail.note?.trim() || '',
      });
    }

    const daysArray = await this.prisma.day.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, dayName: true, position: true },
      orderBy: { position: 'asc' },
    });

    const entriesByDayMap: Map<string, any> = new Map();
    for (const day of daysArray) {
      const dayEntries = entriesByDay.get(day.id) ?? [];
      entriesByDayMap.set(day.dayName, {
        dayName: day.dayName,
        position: day.position,
        entries: dayEntries.sort(
          (left, right) => left.periodNumber - right.periodNumber,
        ),
      });
    }

    // Load all teachers for this section
    const teacherAssignments = await this.prisma.teach.findMany({
      where: { sectionId: classId },
      select: {
        teacherId: true,
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
        course: { select: { title: true } },
      },
      orderBy: { id: 'asc' },
    });

    const courseTitles = [
      ...new Set(teacherAssignments.map((t) => t.course.title)),
    ];

    const roster: any[] = teacherAssignments.map((t) => ({
      teacherName: formatFullName(t.teacher.person),
      courseTitle: t.course.title,
      isCurrentDirector: true,
    }));

    const summary = {
      id: section.id,
      className: section.class.className,
      sectionTitle: section.sectionTitle.title,
      yearTitle: section.year.title,
      stage: section.class.stage.title,
      primaryCourseTitle: courseTitles.join(', '),
      courseTitles,
      studentCount,
      isAssignedToCurrentDirector: true,
    };

    return {
      summary,
      students,
      schedule: {
        ownerLabel: summary.className,
        days: Array.from(entriesByDayMap.values()),
      },
      roster,
    };
  }
}
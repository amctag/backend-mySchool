import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import { formatClassLabel, formatFullName } from './director.util';
import {
  DirectorScheduleDayDto,
  DirectorScheduleEntryDto,
  DirectorScheduleMode,
  DirectorScheduleOptionsQueryDto,
  DirectorScheduleOptionsResponseDto,
  DirectorScheduleSessionDto,
  DirectorScheduleYearDto,
  DirectorTeachingAssignmentItemDto,
  DirectorTeachingAssignmentsResponseDto,
  DirectorWeeklyScheduleQueryDto,
  DirectorWeeklyScheduleResponseDto,
} from './dto/director-schedule.dto';

/**
 * A single timetable cell joined with everything needed to label it:
 * weekday, period, course, section/class and teacher.
 *
 * weekly_schedule_details is the source of truth for a section timetable.
 * The teacher stored on a cell is `personId`; it is nullable, so the
 * assignment (teach) is used as a fallback when the cell has no person.
 */
const scheduleDetailSelect = {
  id: true,
  courseId: true,
  personId: true,
  note: true,
  day: { select: { id: true, dayName: true, position: true } },
  session: {
    select: { id: true, sessionName: true, position: true },
  },
  course: { select: { id: true, title: true } },
  person: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  schedule: {
    select: {
      id: true,
      sectionId: true,
      section: {
        select: {
          id: true,
          classId: true,
          yearId: true,
          class: { select: { id: true, className: true } },
          sectionTitle: { select: { title: true } },
        },
      },
    },
  },
} satisfies Prisma.WeeklyScheduleDetailSelect;

type ScheduleDetailRecord = Prisma.WeeklyScheduleDetailGetPayload<{
  select: typeof scheduleDetailSelect;
}>;

type CalendarSession = {
  id: number;
  sessionName: string;
  position: number;
};

type CalendarDay = {
  id: number;
  dayName: string;
  position: number;
};

type TeacherAccessRecord = {
  id: number;
  personId: number;
  person: {
    firstName: string;
    middleName: string | null;
    lastName: string;
  };
};

@Injectable()
export class DirectorScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  /**
   * Selectors for the schedule screen: classes with their sections for the
   * active year, and every teacher that belongs to the director's school.
   */
  async getOptions(
    user: AuthenticatedDirector,
    query: DirectorScheduleOptionsQueryDto,
  ): Promise<DirectorScheduleOptionsResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const year = await this.resolveYear(user.schoolId, query.yearId);

    const [sections, teachers] = await Promise.all([
      year
        ? this.prisma.section.findMany({
            where: {
              schoolId: user.schoolId,
              yearId: year.id,
            },
            select: {
              id: true,
              classId: true,
              class: {
                select: { id: true, className: true, position: true },
              },
              sectionTitle: { select: { title: true } },
              _count: {
                select: {
                  registrations: { where: { status: true } },
                },
              },
            },
            orderBy: [
              { class: { position: 'asc' } },
              { class: { className: 'asc' } },
              { sectionTitle: { title: 'asc' } },
              { id: 'asc' },
            ],
          })
        : [],
      this.prisma.teacher.findMany({
        where: {
          schools: { some: { schoolId: user.schoolId, isActive: true } },
        },
        select: {
          id: true,
          personId: true,
          person: {
            select: {
              username: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { person: { firstName: 'asc' } },
          { person: { lastName: 'asc' } },
          { id: 'asc' },
        ],
      }),
    ]);

    const classGroups = new Map<
      number,
      DirectorScheduleOptionsResponseDto['classes'][number]
    >();

    for (const section of sections) {
      const classId = section.class.id;
      let group = classGroups.get(classId);
      if (!group) {
        group = {
          classId,
          className: section.class.className,
          sections: [],
        };
        classGroups.set(classId, group);
      }

      group.sections.push({
        sectionId: section.id,
        classId,
        className: section.class.className,
        sectionTitle: section.sectionTitle.title,
        classLabel: formatClassLabel(
          section.class.className,
          section.sectionTitle.title,
        ),
        studentCount: section._count.registrations,
      });
    }

    return {
      year,
      classes: Array.from(classGroups.values()),
      teachers: teachers.map((teacher) => ({
        teacherId: teacher.id,
        personId: teacher.personId,
        fullName: formatFullName(teacher.person),
        username: teacher.person.username,
      })),
    };
  }

  /**
   * Weekly timetable for either one section (class mode) or one teacher
   * (teacher mode). Both modes are scoped to the director's school and to a
   * single academic year.
   */
  async getWeeklySchedule(
    user: AuthenticatedDirector,
    query: DirectorWeeklyScheduleQueryDto,
  ): Promise<DirectorWeeklyScheduleResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const mode = query.mode ?? DirectorScheduleMode.Class;

    if (mode === DirectorScheduleMode.Teacher) {
      return this.getTeacherWeeklySchedule(user, query);
    }

    return this.getClassWeeklySchedule(user, query);
  }

  private async getClassWeeklySchedule(
    user: AuthenticatedDirector,
    query: DirectorWeeklyScheduleQueryDto,
  ): Promise<DirectorWeeklyScheduleResponseDto> {
    if (!query.sectionId) {
      throw new BadRequestException(
        'sectionId is required for a class schedule',
      );
    }

    const year = await this.resolveYear(user.schoolId, query.yearId);
    if (!year) {
      return this.emptySchedule({
        mode: DirectorScheduleMode.Class,
        year: null,
        ownerLabel: '',
        sectionId: query.sectionId,
      });
    }

    const section = await this.prisma.section.findFirst({
      where: {
        id: query.sectionId,
        schoolId: user.schoolId,
        yearId: year.id,
      },
      select: {
        id: true,
        classId: true,
        yearId: true,
        class: { select: { id: true, className: true } },
        sectionTitle: { select: { title: true } },
      },
    });

    if (!section) {
      throw new NotFoundException(
        'Section not found in this school for the active academic year',
      );
    }

    const [calendar, details, teaches] = await Promise.all([
      this.loadCalendar(user.schoolId),
      this.prisma.weeklyScheduleDetail.findMany({
        where: {
          schedule: {
            sectionId: section.id,
            section: {
              schoolId: user.schoolId,
              yearId: year.id,
            },
          },
        },
        select: scheduleDetailSelect,
        orderBy: [{ id: 'asc' }],
      }),
      this.prisma.teach.findMany({
        where: {
          sectionId: section.id,
          yearId: year.id,
        },
        select: {
          teacherId: true,
          courseId: true,
          teacher: {
            select: {
              personId: true,
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
      }),
    ]);

    const teachByCourse = new Map(
      teaches.map((teach) => [teach.courseId, teach]),
    );

    const entriesByDay = this.groupEntriesByDay(
      details,
      (detail) => {
        const teach = teachByCourse.get(detail.courseId);
        const person = detail.person ?? teach?.teacher.person ?? null;

        return {
          teacherId: teach?.teacherId ?? null,
          teacherPersonId: detail.personId ?? teach?.teacher.personId ?? null,
          teacherName: person ? formatFullName(person) : '',
        };
      },
    );

    const classLabel = formatClassLabel(
      section.class.className,
      section.sectionTitle.title,
    );

    return {
      mode: DirectorScheduleMode.Class,
      year,
      ownerLabel: classLabel,
      classId: section.class.id,
      className: section.class.className,
      sectionId: section.id,
      sectionTitle: section.sectionTitle.title,
      teacherId: null,
      teacherName: null,
      entryCount: this.countEntries(entriesByDay),
      sessions: this.toSessionDtos(calendar.sessions),
      days: this.toDayDtos(calendar.days, entriesByDay),
    };
  }

  private async getTeacherWeeklySchedule(
    user: AuthenticatedDirector,
    query: DirectorWeeklyScheduleQueryDto,
  ): Promise<DirectorWeeklyScheduleResponseDto> {
    if (!query.teacherId) {
      throw new BadRequestException(
        'teacherId is required for a teacher schedule',
      );
    }

    const teacher = await this.prisma.teacher.findFirst({
      where: {
        id: query.teacherId,
        schools: { some: { schoolId: user.schoolId, isActive: true } },
      },
      select: {
        id: true,
        personId: true,
        person: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found in this school');
    }

    const teacherName = formatFullName(teacher.person);
    const year = await this.resolveYear(user.schoolId, query.yearId);
    if (!year) {
      return this.emptySchedule({
        mode: DirectorScheduleMode.Teacher,
        year: null,
        ownerLabel: teacherName,
        teacherId: teacher.id,
        teacherName,
      });
    }

    const assignments = await this.prisma.teach.findMany({
      where: {
        teacherId: teacher.id,
        yearId: year.id,
        section: { schoolId: user.schoolId, yearId: year.id },
      },
      select: { id: true, sectionId: true, courseId: true },
      orderBy: [{ id: 'asc' }],
    });

    const sectionIds = Array.from(
      new Set(assignments.map((assignment) => assignment.sectionId)),
    );
    const assignmentKeys = new Set(
      assignments.map(
        (assignment) => `${assignment.sectionId}:${assignment.courseId}`,
      ),
    );

    const [calendar, sectionDetails, personDetails] = await Promise.all([
      this.loadCalendar(user.schoolId),
      sectionIds.length > 0
        ? this.prisma.weeklyScheduleDetail.findMany({
            where: {
              schedule: {
                sectionId: { in: sectionIds },
                section: {
                  schoolId: user.schoolId,
                  yearId: year.id,
                },
              },
            },
            select: scheduleDetailSelect,
            orderBy: [{ id: 'asc' }],
          })
        : Promise.resolve([]),
      this.prisma.weeklyScheduleDetail.findMany({
        where: {
          personId: teacher.personId,
          schedule: {
            section: {
              schoolId: user.schoolId,
              yearId: year.id,
            },
          },
        },
        select: scheduleDetailSelect,
        orderBy: [{ id: 'asc' }],
      }),
    ]);

    // A cell belongs to the teacher when it matches one of their Teach rows
    // (section + course) or when the cell itself is assigned to their person.
    // Matching by Teach covers cells saved before the teacher was assigned,
    // because those cells usually have a null personId.
    const uniqueDetails = new Map<number, ScheduleDetailRecord>();
    for (const detail of sectionDetails) {
      const key = `${detail.schedule.sectionId}:${detail.courseId}`;
      if (assignmentKeys.has(key)) {
        uniqueDetails.set(detail.id, detail);
      }
    }
    for (const detail of personDetails) {
      uniqueDetails.set(detail.id, detail);
    }

    const entriesByDay = this.groupEntriesByDay(
      Array.from(uniqueDetails.values()),
      (detail) => ({
        teacherId: teacher.id,
        teacherPersonId: detail.personId ?? teacher.personId,
        teacherName,
      }),
    );

    return {
      mode: DirectorScheduleMode.Teacher,
      year,
      ownerLabel: teacherName,
      classId: null,
      className: null,
      sectionId: null,
      sectionTitle: null,
      teacherId: teacher.id,
      teacherName,
      entryCount: this.countEntries(entriesByDay),
      sessions: this.toSessionDtos(calendar.sessions),
      days: this.toDayDtos(calendar.days, entriesByDay),
    };
  }

  /**
   * Teaching assignments for the director's school in the active year.
   * Kept for the agenda/activity composers, which build their audience from
   * this list.
   */
  async listAssignments(
    user: AuthenticatedDirector,
    query: { page?: number; limit?: number },
  ): Promise<DirectorTeachingAssignmentsResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const year = await this.resolveYear(user.schoolId);
    if (!year) {
      return {
        items: [],
        pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
      };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 100;

    const where = {
      yearId: year.id,
      section: { schoolId: user.schoolId, yearId: year.id },
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.teach.count({ where }),
      this.prisma.teach.findMany({
        where,
        select: {
          id: true,
          sectionId: true,
          courseId: true,
          course: { select: { title: true } },
          year: { select: { title: true } },
          section: {
            select: {
              classId: true,
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
        orderBy: [{ id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items: DirectorTeachingAssignmentItemDto[] = rows.map((row) => ({
      id: row.id,
      class_id: row.sectionId,
      school_class_id: row.section.class.id,
      class_name: row.section.class.className,
      section_title: row.section.sectionTitle.title,
      year_title: row.year.title,
      stage_id: row.section.class.stage.id,
      stage: row.section.class.stage.title,
      course_title: row.course.title,
      day_name: '',
      period_number: 0,
      period_label: '',
      start_time: '',
      end_time: '',
      room: '',
    }));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async resolveYear(
    schoolId: number,
    requestedYearId?: number,
  ): Promise<DirectorScheduleYearDto | null> {
    const year = await this.prisma.year.findFirst({
      where: {
        schoolId,
        ...(requestedYearId ? { id: requestedYearId } : {}),
      },
      select: { id: true, title: true },
      orderBy: [{ isCurrent: 'desc' }, { id: 'desc' }],
    });

    if (!year && requestedYearId) {
      throw new NotFoundException('Academic year not found in this school');
    }

    return year;
  }

  private async loadCalendar(schoolId: number): Promise<{
    days: CalendarDay[];
    sessions: CalendarSession[];
  }> {
    const [days, sessions] = await Promise.all([
      this.prisma.day.findMany({
        where: { schoolId },
        select: { id: true, dayName: true, position: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.session.findMany({
        where: { schoolId, status: true },
        select: { id: true, sessionName: true, position: true },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      }),
    ]);

    return { days, sessions };
  }

  private groupEntriesByDay(
    details: ScheduleDetailRecord[],
    resolveTeacher: (detail: ScheduleDetailRecord) => {
      teacherId: number | null;
      teacherPersonId: number | null;
      teacherName: string;
    },
  ): Map<number, DirectorScheduleEntryDto[]> {
    const entriesByDay = new Map<number, DirectorScheduleEntryDto[]>();
    const seenCells = new Set<string>();

    for (const detail of details) {
      const section = detail.schedule.section;

      // Two rows for the exact same section/day/period/course are duplicates
      // (for example a stale second weekly_schedules row). Different courses
      // that share a period are kept: they are real timetable entries.
      const cellKey = [
        section.id,
        detail.day.id,
        detail.session.id,
        detail.courseId,
      ].join(':');
      if (seenCells.has(cellKey)) {
        continue;
      }
      seenCells.add(cellKey);

      const teacher = resolveTeacher(detail);
      const classLabel = section
        ? formatClassLabel(
            section.class.className,
            section.sectionTitle.title,
          )
        : null;

      const entry: DirectorScheduleEntryDto = {
        detailId: detail.id,
        dayId: detail.day.id,
        dayName: detail.day.dayName,
        dayPosition: detail.day.position,
        sessionId: detail.session.id,
        periodNumber: detail.session.position,
        periodLabel: detail.session.sessionName,
        courseId: detail.course.id,
        courseTitle: detail.course.title,
        classId: section?.class.id ?? null,
        className: section?.class.className ?? null,
        sectionId: section?.id ?? detail.schedule.sectionId,
        sectionTitle: section?.sectionTitle.title ?? null,
        classLabel,
        teacherId: teacher.teacherId,
        teacherPersonId: teacher.teacherPersonId,
        teacherName: teacher.teacherName,
        note: detail.note?.trim() ?? '',
      };

      const bucket = entriesByDay.get(detail.day.id) ?? [];
      bucket.push(entry);
      entriesByDay.set(detail.day.id, bucket);
    }

    for (const entries of entriesByDay.values()) {
      entries.sort((left, right) => {
        if (left.periodNumber !== right.periodNumber) {
          return left.periodNumber - right.periodNumber;
        }
        if (left.sessionId !== right.sessionId) {
          return left.sessionId - right.sessionId;
        }
        const byCourse = left.courseTitle.localeCompare(right.courseTitle);
        return byCourse !== 0 ? byCourse : left.detailId - right.detailId;
      });
    }

    return entriesByDay;
  }

  private toDayDtos(
    days: CalendarDay[],
    entriesByDay: Map<number, DirectorScheduleEntryDto[]>,
  ): DirectorScheduleDayDto[] {
    return days.map((day) => ({
      dayId: day.id,
      dayName: day.dayName,
      position: day.position,
      entries: entriesByDay.get(day.id) ?? [],
    }));
  }

  private toSessionDtos(sessions: CalendarSession[]): DirectorScheduleSessionDto[] {
    return sessions.map((session) => ({
      id: session.id,
      name: session.sessionName,
      position: session.position,
    }));
  }

  private countEntries(
    entriesByDay: Map<number, DirectorScheduleEntryDto[]>,
  ): number {
    let total = 0;
    for (const entries of entriesByDay.values()) {
      total += entries.length;
    }
    return total;
  }

  private emptySchedule(params: {
    mode: DirectorScheduleMode;
    year: DirectorScheduleYearDto | null;
    ownerLabel: string;
    sectionId?: number;
    teacherId?: number;
    teacherName?: string | null;
  }): DirectorWeeklyScheduleResponseDto {
    return {
      mode: params.mode,
      year: params.year,
      ownerLabel: params.ownerLabel,
      classId: null,
      className: null,
      sectionId: params.sectionId ?? null,
      sectionTitle: null,
      teacherId: params.teacherId ?? null,
      teacherName: params.teacherName ?? null,
      entryCount: 0,
      sessions: [],
      days: [],
    };
  }
}

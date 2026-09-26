import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

export type AttendanceMode = 'school' | 'teacher' | 'teacher_course';

export type SchoolAttendancePolicy = {
  attendanceMode: AttendanceMode;
  /** Derived: teachers may take attendance (not school-only). */
  teachersCanTakeAttendance: boolean;
  /** Derived: per-course sheets when mode is teacher_course. */
  attendancePerCourse: boolean;
};

export type FirstSessionSlot = {
  courseId: number;
  personId: number | null;
  sessionPosition: number;
};

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function normalizeAttendanceMode(value: unknown): AttendanceMode {
  if (value === 'teacher' || value === 'teacher_course' || value === 'school') {
    return value;
  }
  return 'school';
}

@Injectable()
export class SchoolAttendancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy(schoolId: number): Promise<SchoolAttendancePolicy> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { attendanceMode: true },
    });
    const attendanceMode = normalizeAttendanceMode(school?.attendanceMode);
    return {
      attendanceMode,
      teachersCanTakeAttendance: attendanceMode !== 'school',
      attendancePerCourse: attendanceMode === 'teacher_course',
    };
  }

  weekdayPosition(date: Date): number {
    const day = date.getUTCDay();
    return day === 0 ? 7 : day;
  }

  weekdayName(date: Date): string {
    return WEEKDAY_NAMES[date.getUTCDay()];
  }

  async findFirstSession(
    schoolId: number,
    sectionId: number,
    date: Date,
  ): Promise<FirstSessionSlot | null> {
    const map = await this.firstSessionsBySection(schoolId, [sectionId], date);
    return map.get(sectionId) ?? null;
  }

  async firstSessionsBySection(
    schoolId: number,
    sectionIds: number[],
    date: Date,
  ): Promise<Map<number, FirstSessionSlot>> {
    const result = new Map<number, FirstSessionSlot>();
    if (sectionIds.length === 0) {
      return result;
    }
    const dayName = this.weekdayName(date);
    const dayPosition = this.weekdayPosition(date);
    const rows = await this.prisma.weeklyScheduleDetail.findMany({
      where: {
        schedule: { sectionId: { in: sectionIds } },
        day: {
          schoolId,
          OR: [{ dayName }, { position: dayPosition }],
        },
      },
      orderBy: [{ session: { position: 'asc' } }, { id: 'asc' }],
      select: {
        courseId: true,
        personId: true,
        schedule: { select: { sectionId: true } },
        session: { select: { position: true } },
      },
    });
    for (const row of rows) {
      const sectionId = row.schedule.sectionId;
      if (result.has(sectionId)) {
        continue;
      }
      result.set(sectionId, {
        courseId: row.courseId,
        personId: row.personId,
        sessionPosition: row.session.position,
      });
    }

    await this.resolveMissingFirstSessionTeachers(result);
    return result;
  }

  /**
   * When schedule personId is missing/stale, resolve from Teach for that
   * section + first-session course.
   */
  private async resolveMissingFirstSessionTeachers(
    slots: Map<number, FirstSessionSlot>,
  ): Promise<void> {
    const missing = [...slots.entries()].filter(
      ([, slot]) => slot.personId == null,
    );
    if (missing.length === 0) {
      return;
    }

    const teaches = await this.prisma.teach.findMany({
      where: {
        OR: missing.map(([sectionId, slot]) => ({
          sectionId,
          courseId: slot.courseId,
        })),
      },
      select: {
        sectionId: true,
        courseId: true,
        teacher: { select: { personId: true } },
      },
    });

    for (const teach of teaches) {
      const slot = slots.get(teach.sectionId);
      if (
        slot &&
        slot.courseId === teach.courseId &&
        slot.personId == null &&
        teach.teacher.personId
      ) {
        slot.personId = teach.teacher.personId;
      }
    }
  }

  async canTeacherTakeAttendance(params: {
    schoolId: number;
    teacherPersonId: number;
    teacherId: number;
    sectionId: number;
    date: Date;
    courseId?: number | null;
  }): Promise<{ allowed: boolean; courseId: number | null }> {
    const policy = await this.getPolicy(params.schoolId);
    if (!policy.teachersCanTakeAttendance) {
      return { allowed: false, courseId: null };
    }

    // Class-level attendance: any teacher assigned to the section.
    if (!policy.attendancePerCourse) {
      const assignment = await this.prisma.teach.findFirst({
        where: {
          teacherId: params.teacherId,
          sectionId: params.sectionId,
        },
        select: { id: true },
      });
      return { allowed: assignment != null, courseId: null };
    }

    const courseId = params.courseId ?? null;
    if (!courseId) {
      return { allowed: false, courseId: null };
    }
    const assignment = await this.prisma.teach.findFirst({
      where: {
        teacherId: params.teacherId,
        sectionId: params.sectionId,
        courseId,
      },
      select: { id: true },
    });
    return { allowed: assignment != null, courseId };
  }
}

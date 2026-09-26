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
    const rows = await this.prisma.weeklyScheduleDetail.findMany({
      where: {
        schedule: { sectionId: { in: sectionIds } },
        day: { schoolId, position: this.weekdayPosition(date) },
      },
      orderBy: { session: { position: 'asc' } },
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
    return result;
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

    // Class-level attendance: only the teacher of the first session that day.
    if (!policy.attendancePerCourse) {
      const first = await this.findFirstSession(
        params.schoolId,
        params.sectionId,
        params.date,
      );
      const isFirstSessionTeacher =
        first != null && first.personId === params.teacherPersonId;
      return { allowed: isFirstSessionTeacher, courseId: null };
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

export type SchoolAttendancePolicy = {
  attendancePerCourse: boolean;
};

export type FirstSessionSlot = {
  courseId: number;
  personId: number | null;
  sessionPosition: number;
};

@Injectable()
export class SchoolAttendancePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getPolicy(schoolId: number): Promise<SchoolAttendancePolicy> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { attendancePerCourse: true },
    });
    return { attendancePerCourse: school?.attendancePerCourse ?? false };
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
    const [policy, firstSession] = await Promise.all([
      this.getPolicy(params.schoolId),
      this.findFirstSession(params.schoolId, params.sectionId, params.date),
    ]);

    if (policy.attendancePerCourse) {
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

    const firstCourseId = firstSession?.courseId ?? null;
    if (firstSession?.personId === params.teacherPersonId) {
      return { allowed: true, courseId: null };
    }
    if (!firstCourseId) {
      return { allowed: false, courseId: null };
    }
    const assignment = await this.prisma.teach.findFirst({
      where: {
        teacherId: params.teacherId,
        sectionId: params.sectionId,
        courseId: firstCourseId,
      },
      select: { id: true },
    });
    return { allowed: assignment != null, courseId: null };
  }
}

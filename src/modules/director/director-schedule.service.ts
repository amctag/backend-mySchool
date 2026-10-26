import { Injectable } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import { DirectorScheduleResponseDto } from './dto/director-schedule.dto';

@Injectable()
export class DirectorScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async getSchedule(
    user: AuthenticatedDirector,
  ): Promise<DirectorScheduleResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    // Get all sections in the director's school
    const sections = await this.prisma.section.findMany({
      where: { schoolId: user.schoolId },
      select: {
        id: true,
        class: { select: { className: true } },
        sectionTitle: { select: { title: true } },
        year: { select: { title: true } },
      },
      orderBy: [{ class: { className: 'asc' } }, { id: 'asc' }],
    });

    // Get all teaches in the school
    const teaches = await this.prisma.teach.findMany({
      where: {
        section: { schoolId: user.schoolId },
      },
      select: {
        id: true,
        sectionId: true,
        course: { select: { id: true, title: true } },
        year: { select: { title: true } },
      },
    });

    // Build a map of sectionId -> course info
    const courseMap = new Map<number, { courseId: number; courseTitle: string; yearTitle: string }>();
    for (const teach of teaches) {
      courseMap.set(teach.sectionId, {
        courseId: teach.course.id,
        courseTitle: teach.course.title,
        yearTitle: teach.year.title,
      });
    }

    // Get weekly schedule details
    const sectionIds = sections.map((s) => s.id);
    const scheduleDetails = await this.prisma.weeklyScheduleDetail.findMany({
      where: {
        OR: [
          { schedule: { section: { schoolId: user.schoolId } } },
          { schedule: { sectionId: { in: sectionIds } } },
        ],
      },
      select: {
        day: { select: { id: true, dayName: true, position: true } },
        session: { select: { id: true, sessionName: true, position: true } },
        course: { select: { id: true, title: true } },
        schedule: { select: { sectionId: true } },
      },
    });

    // Build schedule entries by day and section
    const scheduleBySectionAndDay = new Map<
      number,
      { dayName: string; periodNumber: number; courseTitle: string }[]
    >();

    for (const detail of scheduleDetails) {
      const sectionId = detail.schedule.sectionId;
      const dayId = detail.day.id;

      if (!scheduleBySectionAndDay.has(sectionId)) {
        scheduleBySectionAndDay.set(sectionId, []);
      }

      const entries = scheduleBySectionAndDay.get(sectionId)!;
      entries.push({
        dayName: detail.day.dayName,
        periodNumber: detail.session.position,
        courseTitle: detail.course?.title || 'Unknown',
      });
    }

    return {
      ownerLabel: user.username,
      days: sections.map((section) => {
        const courseInfo = courseMap.get(section.id);
        const sectionSchedules = scheduleBySectionAndDay.get(section.id) || [];

        return {
          dayName: section.class.className, // Using className as a placeholder
          position: 0,
          entries: sectionSchedules.map((e) => ({
            courseTitle: e.courseTitle,
            periodNumber: e.periodNumber,
            // Note: simplified - full period label not mapped
          })),
        } as any;
      }),
    };
  }

  async listAssignments(
    user: AuthenticatedDirector,
    query: any,
  ): Promise<DirectorScheduleResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const sections = await this.prisma.section.findMany({
      where: { schoolId: user.schoolId },
      select: {
        id: true,
        class: { select: { className: true } },
        sectionTitle: { select: { title: true } },
      },
      orderBy: [{ class: { className: 'asc' } }, { id: 'asc' }],
    });

    return {
      ownerLabel: user.username,
      days: sections.map((section) => ({
        dayName: section.class.className,
        position: 0,
        entries: [],
      })),
    };
  }
}
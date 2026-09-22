import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  DashboardOverviewQueryDto,
  DashboardOverviewResponseDto,
} from './dto/dashboard-overview-response.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(
    user: AuthenticatedSchool,
    query: DashboardOverviewQueryDto,
  ): Promise<DashboardOverviewResponseDto> {
    const school = await this.prisma.school.findFirst({
      where: { id: user.schoolId },
      select: { id: true, name: true },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }

    let yearId = query.yearId ?? null;
    let yearTitle: string | null = null;
    if (yearId) {
      const year = await this.prisma.year.findFirst({
        where: { id: yearId, schoolId: school.id },
        select: { id: true, title: true },
      });
      if (!year) {
        throw new NotFoundException('Year not found');
      }
      yearId = year.id;
      yearTitle = year.title;
    } else {
      const current = await this.prisma.year.findFirst({
        where: { schoolId: school.id, isCurrent: true },
        select: { id: true, title: true },
        orderBy: { id: 'desc' },
      });
      if (current) {
        yearId = current.id;
        yearTitle = current.title;
      }
    }

    const today = this.todayDateOnly();

    const [
      students,
      teachers,
      classes,
      absencesToday,
      recentStudentRows,
      todayAgendaRows,
      announcementRows,
    ] = await Promise.all([
      this.prisma.student.count({
        where: {
          person: { schoolId: school.id },
          ...(yearId
            ? {
                registrations: {
                  some: {
                    status: true,
                    schoolId: school.id,
                    section: { yearId },
                  },
                },
              }
            : {}),
        },
      }),
      this.prisma.teacher.count({
        where: { person: { schoolId: school.id } },
      }),
      this.prisma.class.count({
        where: { stage: { schoolId: school.id } },
      }),
      this.prisma.attendanceDetail.count({
        where: {
          status: 'absent',
          deletedAt: null,
          attendance: {
            deletedAt: null,
            status: true,
            date: today,
            section: {
              schoolId: school.id,
              ...(yearId ? { yearId } : {}),
            },
          },
        },
      }),
      this.prisma.student.findMany({
        where: {
          person: { schoolId: school.id },
          ...(yearId
            ? {
                registrations: {
                  some: {
                    status: true,
                    schoolId: school.id,
                    section: { yearId },
                  },
                },
              }
            : {}),
        },
        take: 6,
        orderBy: { id: 'desc' },
        select: {
          id: true,
          person: {
            select: { firstName: true, middleName: true, lastName: true },
          },
          parent: {
            select: {
              person: {
                select: { firstName: true, middleName: true, lastName: true },
              },
            },
          },
          registrations: {
            where: {
              status: true,
              schoolId: school.id,
              ...(yearId ? { section: { yearId } } : {}),
            },
            take: 1,
            orderBy: { id: 'desc' },
            select: {
              section: {
                select: {
                  sectionTitle: { select: { title: true } },
                  class: { select: { className: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.agenda.findMany({
        where: {
          deletedAt: null,
          agendaDate: today,
          course: { schoolId: school.id },
          ...(yearId
            ? {
                sections: {
                  some: {
                    deletedAt: null,
                    section: { schoolId: school.id, yearId },
                  },
                },
              }
            : {
                sections: {
                  some: {
                    deletedAt: null,
                    section: { schoolId: school.id },
                  },
                },
              }),
        },
        take: 6,
        orderBy: [{ time: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          time: true,
          course: { select: { title: true } },
          sections: {
            where: {
              deletedAt: null,
              ...(yearId
                ? { section: { schoolId: school.id, yearId } }
                : { section: { schoolId: school.id } }),
            },
            select: {
              section: {
                select: {
                  class: { select: { className: true } },
                  sectionTitle: { select: { title: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.announcement.findMany({
        where: {
          deletedAt: null,
          personId: DASHBOARD_CREATOR_PERSON_ID,
        },
        take: 5,
        orderBy: [
          { publishDate: 'desc' },
          { publishTime: 'desc' },
          { id: 'desc' },
        ],
        select: {
          id: true,
          title: true,
          content: true,
          targets: {
            select: { audienceTarget: true },
          },
        },
      }),
    ]);

    return {
      schoolName: school.name,
      yearId,
      yearTitle,
      stats: {
        students,
        teachers,
        classes,
        absencesToday,
      },
      recentStudents: recentStudentRows.map((student) => {
        const registration = student.registrations[0];
        return {
          studentId: student.id,
          name: this.personName(student.person),
          className: registration?.section.class.className ?? null,
          sectionName: registration?.section.sectionTitle.title ?? null,
          parentName: student.parent
            ? this.personName(student.parent.person)
            : null,
        };
      }),
      todayAgendas: todayAgendaRows.map((agenda) => ({
        id: agenda.id,
        title: agenda.title,
        description: agenda.description,
        time: agenda.time,
        courseTitle: agenda.course.title,
        sectionsLabel:
          agenda.sections
            .map(
              (link) =>
                `${link.section.class.className}/${link.section.sectionTitle.title}`,
            )
            .join(', ') || '—',
      })),
      recentAnnouncements: announcementRows.map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        audienceLabel: this.audienceLabel(
          item.targets.map((target) => target.audienceTarget),
        ),
      })),
    };
  }

  private todayDateOnly(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );
  }

  private personName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
  }

  private audienceLabel(targets: string[]): string {
    const labels = targets.map((target) => {
      if (target === 'parent') {
        return 'Parents';
      }
      if (target === 'teacher') {
        return 'Teachers';
      }
      if (target === 'student') {
        return 'Students';
      }
      return target;
    });
    return labels.length > 0 ? [...new Set(labels)].join(', ') : 'All school';
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import ms from 'ms';
import type { StringValue } from 'ms';
import {
  AuthenticatedParent,
  JwtPayload,
  PasswordResetJwtPayload,
} from '../../auth/interfaces/jwt-payload.interface';
import { SessionService } from '../../auth/services/session.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { ParentChangePasswordRequestOtpResponseDto } from './dto/parent-change-password-request-otp-response.dto';
import { ParentChangePasswordResponseDto } from './dto/parent-change-password-response.dto';
import { ParentChangePasswordDto } from './dto/parent-change-password.dto';
import { ParentForgotPasswordRequestOtpDto } from './dto/parent-forgot-password-request-otp.dto';
import { ParentForgotPasswordRequestOtpResponseDto } from './dto/parent-forgot-password-request-otp-response.dto';
import { ParentForgotPasswordResetDto } from './dto/parent-forgot-password-reset.dto';
import { ParentForgotPasswordResetResponseDto } from './dto/parent-forgot-password-reset-response.dto';
import { ParentForgotPasswordVerifyOtpDto } from './dto/parent-forgot-password-verify-otp.dto';
import { ParentForgotPasswordVerifyOtpResponseDto } from './dto/parent-forgot-password-verify-otp-response.dto';
import { ParentLoginResponseDto } from './dto/parent-login-response.dto';
import { ParentLoginDto } from './dto/parent-login.dto';
import { ParentLogoutResponseDto } from './dto/parent-logout-response.dto';
import { ParentMeChildDetailResponseDto } from './dto/parent-me-children-response.dto';
import { ParentMeChildrenSummaryResponseDto } from './dto/parent-me-children-summary-response.dto';
import { ParentMeResponseDto } from './dto/parent-me-response.dto';
import { ParentRefreshResponseDto } from './dto/parent-refresh-response.dto';
import {
  ParentChildWeeklyScheduleDto,
  ParentWeeklyScheduleResponseDto,
  WeeklyScheduleCourseDto,
  WeeklyScheduleDayDto,
} from './dto/parent-weekly-schedule-response.dto';
import { ParentAnnouncementsResponseDto } from './dto/parent-announcements-response.dto';
import { ParentActivitiesResponseDto } from './dto/parent-activities-response.dto';
import { ParentSchoolDetailsResponseDto } from './dto/parent-school-details-response.dto';
import { ParentAttendanceAbsencesResponseDto } from './dto/parent-attendance-absences-response.dto';
import { ParentNoticesResponseDto } from './dto/parent-notices-response.dto';
import { ParentAgendasResponseDto } from './dto/parent-agendas-response.dto';
import {
  ParentAlbumDetailResponseDto,
  ParentAlbumImageDto,
  ParentAlbumsResponseDto,
} from './dto/parent-albums-response.dto';
import { SchoolService } from '../school/school.service';

type LoginParentPerson = {
  id: number;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  parent: { id: number };
};

@Injectable()
export class ParentService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
    private readonly schoolService: SchoolService,
  ) {}

  async login(loginDto: ParentLoginDto): Promise<ParentLoginResponseDto> {
    const person = await this.validateCredentials(loginDto);
    const tokens = await this.createSession(person);

    return {
      ...tokens,
      name: this.formatFullName(person),
    };
  }

  async getProfile(user: AuthenticatedParent): Promise<ParentMeResponseDto> {
    this.ensureParentRole(user);

    const person = await this.prisma.person.findFirst({
      where: {
        id: user.id,
        status: true,
        parent: { id: user.parentId },
      },
      include: {
        parent: {
          include: {
            _count: {
              select: { students: true },
            },
          },
        },
      },
    });

    if (!person?.parent) {
      throw new NotFoundException('Parent not found');
    }

    return {
      personId: person.id,
      parentId: person.parent.id,
      username: person.username,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      name: this.formatFullName(person),
      email: person.email,
      phoneNumber: person.phoneNumber,
      childrenCount: person.parent._count.students,
    };
  }

  async getChildrenSummary(
    user: AuthenticatedParent,
  ): Promise<ParentMeChildrenSummaryResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: { parentId: user.parentId },
      include: {
        person: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        registrations: {
          where: { status: true },
          include: {
            section: {
              include: {
                year: {
                  select: { title: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        person: { firstName: 'asc' },
      },
    });

    return {
      children: students.map((student) => ({
        studentId: student.id,
        name: this.formatFullName(student.person),
        yearTitle: student.registrations[0]?.section.year.title ?? null,
      })),
    };
  }

  async getChildDetail(
    user: AuthenticatedParent,
    studentId: number,
  ): Promise<ParentMeChildDetailResponseDto> {
    this.ensureParentRole(user);

    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        parentId: user.parentId,
      },
      include: {
        person: {
          include: {
            school: {
              select: { id: true, name: true },
            },
          },
        },
        registrations: {
          where: { status: true },
          include: {
            section: {
              include: {
                class: true,
                sectionTitle: true,
                year: true,
                school: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Child not found');
    }

    return this.mapChildDetail(student);
  }

  async getWeeklySchedule(
    user: AuthenticatedParent,
    studentId?: number,
  ): Promise<ParentWeeklyScheduleResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: {
        parentId: user.parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        person: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        registrations: {
          where: { status: true },
          include: {
            section: {
              include: {
                class: {
                  select: { className: true, classLevel: true },
                },
                sectionTitle: true,
                year: true,
                school: {
                  select: {
                    id: true,
                    name: true,
                    days: {
                      orderBy: { position: 'asc' },
                    },
                  },
                },
                weeklySchedules: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  include: {
                    details: {
                      include: {
                        day: true,
                        session: true,
                        course: {
                          select: { id: true, title: true },
                        },
                        person: {
                          select: {
                            firstName: true,
                            middleName: true,
                            lastName: true,
                          },
                        },
                      },
                      orderBy: [
                        { day: { position: 'asc' } },
                        { session: { position: 'asc' } },
                      ],
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        person: { firstName: 'asc' },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    return {
      schedules: students.map((student) =>
        this.mapStudentWeeklySchedule(student),
      ),
    };
  }

  async getAnnouncements(
    user: AuthenticatedParent,
    studentId?: number,
  ): Promise<ParentAnnouncementsResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: {
        parentId: user.parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        registrations: {
          where: { status: true },
          include: {
            section: {
              select: {
                id: true,
                schoolId: true,
                class: { select: { classLevel: true } },
                sectionTitle: { select: { title: true } },
                school: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const sectionIds = [
      ...new Set(
        students
          .map((student) => student.registrations[0]?.section.id)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    const today = this.getTodayDate();
    const currentTime = this.getCurrentPublishTime();

    const announcements = await this.prisma.announcement.findMany({
      where: {
        deletedAt: null,
        targets: {
          some: {
            audienceTarget: 'parent',
            deletedAt: null,
          },
        },
        AND: [
          {
            OR: [
              { publishDate: { lt: today } },
              {
                publishDate: today,
                publishTime: { lte: currentTime },
              },
            ],
          },
        ],
        OR: [
          {
            sections: {
              none: {
                deletedAt: null,
              },
            },
          },
          ...(sectionIds.length > 0
            ? [
                {
                  sections: {
                    some: {
                      deletedAt: null,
                      sectionId: { in: sectionIds },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        sections: {
          where: { deletedAt: null },
          include: {
            section: {
              select: {
                id: true,
                class: { select: { classLevel: true } },
                sectionTitle: { select: { title: true } },
                school: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { publishDate: 'desc' },
        { publishTime: 'desc' },
        { id: 'desc' },
      ],
    });

    return {
      announcements: announcements.map((announcement) =>
        this.mapParentAnnouncement(announcement, sectionIds),
      ),
    };
  }

  async getActivities(
    user: AuthenticatedParent,
    studentId?: number,
  ): Promise<ParentActivitiesResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: {
        parentId: user.parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        registrations: {
          where: { status: true },
          include: {
            section: {
              select: {
                schoolId: true,
                yearId: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const yearIds = [
      ...new Set(
        students
          .map((student) => student.registrations[0]?.section.yearId)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    const schoolIds = [
      ...new Set(
        students
          .map((student) => student.registrations[0]?.section.schoolId)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    const yearScopedFilter =
      yearIds.length > 0 ? [{ yearId: { in: yearIds } }] : [];

    const schoolWideFilter =
      schoolIds.length > 0
        ? [
            {
              yearId: null,
              person: { schoolId: { in: schoolIds } },
            },
          ]
        : [];

    const globalFilter = [{ yearId: null, person: { schoolId: null } }];

    const activities = await this.prisma.activity.findMany({
      where: {
        deletedAt: null,
        OR: [...yearScopedFilter, ...schoolWideFilter, ...globalFilter],
      },
      include: {
        year: {
          select: {
            title: true,
            school: { select: { name: true } },
          },
        },
        person: {
          select: {
            school: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    return {
      activities: activities.map((activity) => this.mapParentActivity(activity)),
    };
  }

  async getSchoolDetails(
    user: AuthenticatedParent,
    studentId?: number,
  ): Promise<ParentSchoolDetailsResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: {
        parentId: user.parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        registrations: {
          where: { status: true },
          include: {
            section: {
              select: { schoolId: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const schoolIds = [
      ...new Set(
        students
          .map((student) => student.registrations[0]?.section.schoolId)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    const schools = await this.schoolService.getSchoolDetailsForSchoolIds(
      schoolIds,
    );

    return { schools };
  }

  async getAlbums(
    user: AuthenticatedParent,
    studentId?: number,
  ): Promise<ParentAlbumsResponseDto> {
    this.ensureParentRole(user);

    const schoolContexts = await this.resolveParentSchoolContexts(
      user.parentId,
      studentId,
    );

    if (schoolContexts.length === 0) {
      return { schools: [] };
    }

    const albums = await this.prisma.album.findMany({
      where: {
        deletedAt: null,
        status: 1,
        OR: schoolContexts.map((context) => ({
          schoolId: context.schoolId,
          yearId: context.yearId,
        })),
      },
      include: {
        school: { select: { id: true, name: true } },
        year: { select: { title: true } },
        images: {
          where: { deletedAt: null },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    const grouped = new Map<
      number,
      { schoolId: number; schoolName: string; albums: ParentAlbumsResponseDto['schools'][number]['albums'] }
    >();

    for (const context of schoolContexts) {
      if (!grouped.has(context.schoolId)) {
        grouped.set(context.schoolId, {
          schoolId: context.schoolId,
          schoolName: context.schoolName,
          albums: [],
        });
      }
    }

    for (const album of albums) {
      const schoolGroup = grouped.get(album.schoolId);

      if (!schoolGroup) {
        continue;
      }

      schoolGroup.albums.push(this.mapParentAlbum(album));
    }

    return {
      schools: [...grouped.values()].sort((first, second) =>
        first.schoolName.localeCompare(second.schoolName),
      ),
    };
  }

  async getAlbumById(
    user: AuthenticatedParent,
    albumId: number,
    studentId?: number,
  ): Promise<ParentAlbumDetailResponseDto> {
    this.ensureParentRole(user);

    const schoolContexts = await this.resolveParentSchoolContexts(
      user.parentId,
      studentId,
    );

    if (schoolContexts.length === 0) {
      throw new NotFoundException('Album not found');
    }

    const album = await this.prisma.album.findFirst({
      where: {
        id: albumId,
        deletedAt: null,
        status: 1,
        OR: schoolContexts.map((context) => ({
          schoolId: context.schoolId,
          yearId: context.yearId,
        })),
      },
      include: {
        school: { select: { id: true, name: true } },
        year: { select: { title: true } },
        images: {
          where: { deletedAt: null },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return {
      id: album.id,
      schoolId: album.school.id,
      schoolName: album.school.name,
      title: album.title,
      description: album.description,
      date: this.formatActivityDate(album.date),
      yearTitle: album.year.title,
      images: album.images.map((image) => this.mapParentAlbumImage(image)),
    };
  }

  async getAttendanceAbsences(
    user: AuthenticatedParent,
    month: string,
    studentId?: number,
  ): Promise<ParentAttendanceAbsencesResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: {
        parentId: user.parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        person: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        registrations: {
          where: { status: true },
          include: {
            section: {
              select: { id: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        person: { firstName: 'asc' },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const studentFilters = students.flatMap((student) => {
      const sectionId = student.registrations[0]?.section.id;

      if (!sectionId) {
        return [];
      }

      return [{ studentId: student.id, sectionId }];
    });

    if (studentFilters.length === 0) {
      return { month, absences: [] };
    }

    const { startDate, endDate } = this.parseMonthRange(month);

    const absenceRecords = await this.prisma.attendanceDetail.findMany({
      where: {
        deletedAt: null,
        status: 'absent',
        OR: studentFilters.map((filter) => ({
          studentId: filter.studentId,
          attendance: {
            sectionId: filter.sectionId,
            deletedAt: null,
            status: true,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        })),
      },
      include: {
        attendance: {
          select: { date: true },
        },
        attendanceReason: {
          select: { title: true },
        },
        student: {
          include: {
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
      orderBy: [{ attendance: { date: 'desc' } }, { id: 'desc' }],
    });

    return {
      month,
      absences: absenceRecords.map((record) => ({
        studentId: record.studentId,
        studentName: this.formatFullName(record.student.person),
        date: this.formatActivityDate(record.attendance.date),
        status: record.status,
        reason: record.attendanceReason?.title ?? null,
        description: record.description,
      })),
    };
  }

  async getNotices(
    user: AuthenticatedParent,
    studentId?: number,
    page = 1,
    limit = 10,
  ): Promise<ParentNoticesResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: {
        parentId: user.parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        person: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        registrations: {
          where: { status: true },
          include: {
            section: {
              include: {
                class: { select: { classLevel: true } },
                sectionTitle: { select: { title: true } },
                school: { select: { name: true, id: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        person: { firstName: 'asc' },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const studentIds = students.map((student) => student.id);
    const sectionIds = [
      ...new Set(
        students
          .map((student) => student.registrations[0]?.section.id)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    const schoolIds = [
      ...new Set(
        students
          .map((student) => student.registrations[0]?.section.schoolId)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    if (studentIds.length === 0) {
      return {
        notices: [],
        pagination: this.buildPaginationMeta(page, limit, 0),
      };
    }

    const notices = await this.prisma.notice.findMany({
      where: {
        deletedAt: null,
        status: true,
        ...(schoolIds.length > 0 ? { schoolId: { in: schoolIds } } : {}),
        OR: [
          {
            students: {
              some: {
                studentId: { in: studentIds },
                deletedAt: null,
              },
            },
          },
          ...(sectionIds.length > 0
            ? [
                {
                  sections: {
                    some: {
                      sectionId: { in: sectionIds },
                      deletedAt: null,
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        students: {
          where: { deletedAt: null },
          select: { studentId: true },
        },
        sections: {
          where: { deletedAt: null },
          select: { sectionId: true },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    const results: ParentNoticesResponseDto['notices'] = [];

    for (const student of students) {
      const section = student.registrations[0]?.section;

      if (!section) {
        continue;
      }

      for (const notice of notices) {
        const viaStudent = notice.students.some(
          (target) => target.studentId === student.id,
        );
        const viaSection = notice.sections.some(
          (target) => target.sectionId === section.id,
        );

        if (!viaStudent && !viaSection) {
          continue;
        }

        results.push({
          id: notice.id,
          studentId: student.id,
          studentName: this.formatFullName(student.person),
          description: notice.description,
          date: this.formatActivityDate(notice.date),
          schoolName: section.school.name,
          sectionName: this.formatSectionName(section.sectionTitle.title),
          class: String(section.class.classLevel),
          receivedVia: viaStudent ? 'student' : 'section',
        });
      }
    }

    results.sort((first, second) => {
      const dateCompare = second.date.localeCompare(first.date);

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return second.id - first.id;
    });

    const paginated = this.paginateResults(results, page, limit);

    return {
      notices: paginated.items,
      pagination: paginated.pagination,
    };
  }

  async getAgendas(
    user: AuthenticatedParent,
    agendaDate: string,
    studentId?: number,
    page = 1,
    limit = 10,
  ): Promise<ParentAgendasResponseDto> {
    this.ensureParentRole(user);

    const students = await this.prisma.student.findMany({
      where: {
        parentId: user.parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        person: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
          },
        },
        registrations: {
          where: { status: true },
          include: {
            section: {
              include: {
                class: { select: { classLevel: true } },
                sectionTitle: { select: { title: true } },
                school: { select: { name: true, id: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        person: { firstName: 'asc' },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const sectionIds = [
      ...new Set(
        students
          .map((student) => student.registrations[0]?.section.id)
          .filter((id): id is number => id !== undefined),
      ),
    ];

    if (sectionIds.length === 0) {
      return {
        agendaDate,
        agendas: [],
        pagination: this.buildPaginationMeta(page, limit, 0),
      };
    }

    const filterDate = this.parseDay(agendaDate);
    const now = new Date();

    const agendas = await this.prisma.agenda.findMany({
      where: {
        deletedAt: null,
        status: 1,
        publishedDate: { lte: now },
        agendaDate: filterDate,
        sections: {
          some: {
            sectionId: { in: sectionIds },
            deletedAt: null,
          },
        },
      },
      include: {
        course: { select: { title: true, schoolId: true } },
        sections: {
          where: { deletedAt: null },
          select: { sectionId: true },
        },
      },
      orderBy: [{ time: 'desc' }, { id: 'desc' }],
    });

    const results: ParentAgendasResponseDto['agendas'] = [];

    for (const student of students) {
      const section = student.registrations[0]?.section;

      if (!section) {
        continue;
      }

      for (const agenda of agendas) {
        const targetsSection = agenda.sections.some(
          (target) => target.sectionId === section.id,
        );

        if (!targetsSection) {
          continue;
        }

        if (agenda.course.schoolId !== section.schoolId) {
          continue;
        }

        results.push({
          id: agenda.id,
          studentId: student.id,
          studentName: this.formatFullName(student.person),
          description: agenda.description,
          agendaDate: this.formatActivityDate(agenda.agendaDate),
          time: agenda.time,
          courseTitle: agenda.course.title,
          imageLink: agenda.imageLink,
          fileLink: agenda.fileLink,
          publishedDate: agenda.publishedDate.toISOString(),
          schoolName: section.school.name,
          sectionName: this.formatSectionName(section.sectionTitle.title),
          class: String(section.class.classLevel),
        });
      }
    }

    results.sort((first, second) => {
      const timeCompare = second.time.localeCompare(first.time);

      if (timeCompare !== 0) {
        return timeCompare;
      }

      return second.id - first.id;
    });

    const paginated = this.paginateResults(results, page, limit);

    return {
      agendaDate,
      agendas: paginated.items,
      pagination: paginated.pagination,
    };
  }

  async requestChangePasswordOtp(
    user: AuthenticatedParent,
  ): Promise<ParentChangePasswordRequestOtpResponseDto> {
    this.ensureParentRole(user);

    const person = await this.prisma.person.findFirst({
      where: {
        id: user.id,
        status: true,
        parent: { id: user.parentId },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
      },
    });

    if (!person?.email) {
      throw new BadRequestException(
        'No email is linked to your account. Contact the school to add one.',
      );
    }

    const otp = this.generateOtp();
    const expiresAt = this.getOtpExpiryDate();
    const expiresInMinutes = this.getOtpExpiresInMinutes();

    await this.mailService.sendOtpEmail(
      person.email,
      otp,
      this.formatFullName(person),
    );

    await this.prisma.passwordChangeOtp.upsert({
      where: { personId: person.id },
      create: {
        personId: person.id,
        otpHash: this.hashOtp(otp),
        expiresAt,
      },
      update: {
        otpHash: this.hashOtp(otp),
        expiresAt,
      },
    });

    return {
      message: 'Verification code sent to your email',
      email: this.maskEmail(person.email),
      expiresInMinutes,
    };
  }

  async changePassword(
    user: AuthenticatedParent,
    changePasswordDto: ParentChangePasswordDto,
  ): Promise<ParentChangePasswordResponseDto> {
    this.ensureParentRole(user);

    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const otpRecord = await this.prisma.passwordChangeOtp.findUnique({
      where: { personId: user.id },
    });

    if (!otpRecord || otpRecord.expiresAt <= new Date()) {
      if (otpRecord) {
        await this.prisma.passwordChangeOtp.delete({
          where: { personId: user.id },
        });
      }
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const submittedHash = this.hashOtp(changePasswordDto.otp);
    if (submittedHash !== otpRecord.otpHash) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const passwordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.person.update({
        where: { id: user.id },
        data: { password: passwordHash },
      }),
      this.prisma.passwordChangeOtp.delete({
        where: { personId: user.id },
      }),
    ]);

    return { message: 'Password changed successfully' };
  }

  async requestForgotPasswordOtp(
    dto: ParentForgotPasswordRequestOtpDto,
  ): Promise<ParentForgotPasswordRequestOtpResponseDto> {
    const expiresInMinutes = this.getOtpExpiresInMinutes();
    const genericMessage =
      'If an account with this username exists, a verification code was sent to the registered email';

    const person = await this.findParentAccountByUsername(dto.username);

    if (!person?.email) {
      return {
        message: genericMessage,
        email: null,
        expiresInMinutes,
      };
    }

    const otp = this.generateOtp();
    const expiresAt = this.getOtpExpiryDate();

    await this.mailService.sendForgotPasswordOtpEmail(
      person.email,
      otp,
      this.formatFullName(person),
    );

    await this.prisma.passwordResetOtp.upsert({
      where: { personId: person.id },
      create: {
        personId: person.id,
        otpHash: this.hashOtp(otp),
        expiresAt,
      },
      update: {
        otpHash: this.hashOtp(otp),
        expiresAt,
      },
    });

    return {
      message: genericMessage,
      email: this.maskEmail(person.email),
      expiresInMinutes,
    };
  }

  async verifyForgotPasswordOtp(
    dto: ParentForgotPasswordVerifyOtpDto,
  ): Promise<ParentForgotPasswordVerifyOtpResponseDto> {
    const person = await this.findParentAccountByUsername(dto.username);

    if (!person) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const otpRecord = await this.prisma.passwordResetOtp.findUnique({
      where: { personId: person.id },
    });

    if (!otpRecord || otpRecord.expiresAt <= new Date()) {
      if (otpRecord) {
        await this.prisma.passwordResetOtp.delete({
          where: { personId: person.id },
        });
      }
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    const submittedHash = this.hashOtp(dto.otp);
    if (submittedHash !== otpRecord.otpHash) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.prisma.passwordResetOtp.delete({
      where: { personId: person.id },
    });

    const resetToken = await this.signPasswordResetToken(person.id);
    const expiresInMinutes = this.getPasswordResetExpiresInMinutes();

    return {
      message: 'Verification code confirmed',
      resetToken,
      expiresInMinutes,
    };
  }

  async resetForgotPassword(
    dto: ParentForgotPasswordResetDto,
  ): Promise<ParentForgotPasswordResetResponseDto> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const personId = await this.verifyPasswordResetToken(dto.resetToken);

    const person = await this.prisma.person.findFirst({
      where: {
        id: personId,
        status: true,
        parent: { isNot: null },
      },
      select: { id: true },
    });

    if (!person) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.person.update({
      where: { id: person.id },
      data: { password: passwordHash },
    });

    await this.revokeParentSessions(person.id);

    return { message: 'Password reset successfully' };
  }

  async refresh(refreshToken: string): Promise<ParentRefreshResponseDto> {
    const session = await this.findSessionByRefreshToken(refreshToken);

    if (!session || session.refreshExpiresAt <= new Date()) {
      if (session) {
        await this.prisma.parentSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const person = await this.findLoginParentPerson(session.personId);

    if (!person?.parent) {
      await this.prisma.parentSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const newRefreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    await this.prisma.parentSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(newRefreshToken),
        refreshExpiresAt,
      },
    });

    return this.buildTokenResponse(person, session.id, newRefreshToken);
  }

  async logout(user: AuthenticatedParent): Promise<ParentLogoutResponseDto> {
    this.ensureParentRole(user);

    await this.revokeParentSessions(user.id);

    return { message: 'Logged out successfully' };
  }

  private mapStudentWeeklySchedule(student: {
    id: number;
    person: {
      firstName: string;
      middleName: string;
      lastName: string;
    };
    registrations: Array<{
      section: {
        class: { classLevel: number };
        sectionTitle: { title: string };
        year: { title: string };
        school: {
          name: string;
          days: Array<{ id: number; dayName: string; position: number }>;
        };
        weeklySchedules: Array<{
          details: Array<{
            dayId: number;
            note: string | null;
            day: { id: number; dayName: string; position: number };
            session: { sessionName: string; position: number };
            course: { id: number; title: string };
            person: {
              firstName: string;
              middleName: string;
              lastName: string;
            } | null;
          }>;
        }>;
      };
    }>;
  }): ParentChildWeeklyScheduleDto {
    const registration = student.registrations[0];
    const section = registration?.section;
    const weeklySchedule = section?.weeklySchedules[0];

    return {
      studentId: student.id,
      studentName: this.formatFullName(student.person),
      sectionName: section
        ? this.formatSectionName(section.sectionTitle.title)
        : '',
      class: section ? String(section.class.classLevel) : '',
      schoolName: section?.school.name ?? '',
      yearTitle: section?.year.title ?? '',
      days: this.buildSevenDaySchedule(
        section?.school.days ?? [],
        weeklySchedule?.details ?? [],
      ),
    };
  }

  private buildSevenDaySchedule(
    schoolDays: Array<{ id: number; dayName: string; position: number }>,
    details: Array<{
      dayId: number;
      note: string | null;
      day: { id: number; dayName: string; position: number };
      session: { sessionName: string; position: number };
      course: { id: number; title: string };
      person: {
        firstName: string;
        middleName: string;
        lastName: string;
      } | null;
    }>,
  ): WeeklyScheduleDayDto[] {
    const weekTemplate = this.getWeekTemplate(schoolDays);
    const coursesByDayId = new Map<number, WeeklyScheduleCourseDto[]>();

    for (const detail of details) {
      const courses = coursesByDayId.get(detail.dayId) ?? [];
      courses.push({
        courseId: detail.course.id,
        courseTitle: detail.course.title,
        sessionName: detail.session.sessionName,
        sessionPosition: detail.session.position,
        teacherName: detail.person ? this.formatFullName(detail.person) : null,
        note: detail.note,
      });
      coursesByDayId.set(detail.dayId, courses);
    }

    return weekTemplate.map((day) => {
      const courses = day.dayId ? (coursesByDayId.get(day.dayId) ?? []) : [];

      return {
        dayName: day.dayName,
        position: day.position,
        courses: courses.sort(
          (first, second) => first.sessionPosition - second.sessionPosition,
        ),
      };
    });
  }

  private getWeekTemplate(
    schoolDays: Array<{ id: number; dayName: string; position: number }>,
  ): Array<{ dayId: number | null; dayName: string; position: number }> {
    const standardWeek = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];

    const schoolDaysByName = new Map(
      schoolDays.map((day) => [day.dayName.toLowerCase(), day]),
    );

    return standardWeek.map((dayName, index) => {
      const schoolDay = schoolDaysByName.get(dayName.toLowerCase());

      return {
        dayId: schoolDay?.id ?? null,
        dayName,
        position: schoolDay?.position ?? index + 1,
      };
    });
  }

  private formatSectionName(title: string): string {
    return title.replace(/^Section\s+/i, '').trim() || title;
  }

  private mapParentAnnouncement(
    announcement: {
      id: number;
      title: string | null;
      content: string;
      publishDate: Date;
      publishTime: Date;
      sections: Array<{
        sectionId: number;
        section: {
          id: number;
          class: { classLevel: number };
          sectionTitle: { title: string };
          school: { name: string };
        };
      }>;
    },
    parentSectionIds: number[],
  ) {
    const isGlobal = announcement.sections.length === 0;
    const matchedSection = announcement.sections.find((item) =>
      parentSectionIds.includes(item.sectionId),
    )?.section;

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      publishedAt: this.combinePublishDateTime(
        announcement.publishDate,
        announcement.publishTime,
      ).toISOString(),
      isGlobal,
      schoolName: matchedSection?.school.name ?? '',
      sectionName: matchedSection
        ? this.formatSectionName(matchedSection.sectionTitle.title)
        : null,
      class: matchedSection ? String(matchedSection.class.classLevel) : null,
    };
  }

  private async resolveParentSchoolContexts(
    parentId: number,
    studentId?: number,
  ): Promise<
    Array<{
      schoolId: number;
      schoolName: string;
      yearId: number;
    }>
  > {
    const students = await this.prisma.student.findMany({
      where: {
        parentId,
        ...(studentId !== undefined ? { id: studentId } : {}),
      },
      include: {
        registrations: {
          where: { status: true },
          include: {
            section: {
              include: {
                school: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (studentId !== undefined && students.length === 0) {
      throw new NotFoundException('Child not found');
    }

    const uniqueContexts = new Map<
      string,
      { schoolId: number; schoolName: string; yearId: number }
    >();

    for (const student of students) {
      const section = student.registrations[0]?.section;

      if (!section) {
        continue;
      }

      const key = `${section.schoolId}:${section.yearId}`;

      if (!uniqueContexts.has(key)) {
        uniqueContexts.set(key, {
          schoolId: section.schoolId,
          schoolName: section.school.name,
          yearId: section.yearId,
        });
      }
    }

    return [...uniqueContexts.values()];
  }

  private mapParentAlbumImage(image: {
    id: number;
    imageLink: string;
    caption: string | null;
    position: number;
  }): ParentAlbumImageDto {
    return {
      id: image.id,
      imageLink: image.imageLink,
      caption: image.caption,
      position: image.position,
    };
  }

  private mapParentAlbum(album: {
    id: number;
    title: string;
    description: string;
    date: Date;
    year: { title: string };
    images: Array<{
      id: number;
      imageLink: string;
      caption: string | null;
      position: number;
    }>;
  }) {
    return {
      id: album.id,
      title: album.title,
      description: album.description,
      date: this.formatActivityDate(album.date),
      yearTitle: album.year.title,
      images: album.images.map((image) => this.mapParentAlbumImage(image)),
    };
  }

  private mapParentActivity(activity: {
    id: number;
    title: string;
    content: string;
    date: Date;
    image: string;
    year: {
      title: string;
      school: { name: string };
    } | null;
    person: {
      school: { name: string } | null;
    };
  }) {
    return {
      id: activity.id,
      title: activity.title,
      content: activity.content,
      date: this.formatActivityDate(activity.date),
      image: activity.image,
      yearTitle: activity.year?.title ?? null,
      schoolName:
        activity.year?.school.name ?? activity.person.school?.name ?? '',
    };
  }

  private formatActivityDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private parseMonthRange(month: string): { startDate: Date; endDate: Date } {
    const [yearText, monthText] = month.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;

    return {
      startDate: new Date(Date.UTC(year, monthIndex, 1)),
      endDate: new Date(Date.UTC(year, monthIndex + 1, 0)),
    };
  }

  private parseDay(day: string): Date {
    const [yearText, monthText, dayText] = day.split('-');

    return new Date(
      Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)),
    );
  }

  private paginateResults<T>(
    items: T[],
    page: number,
    limit: number,
  ): { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } } {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const total = items.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / safeLimit);
    const offset = (safePage - 1) * safeLimit;

    return {
      items: items.slice(offset, offset + safeLimit),
      pagination: this.buildPaginationMeta(safePage, safeLimit, total),
    };
  }

  private buildPaginationMeta(
    page: number,
    limit: number,
    total: number,
  ): { page: number; limit: number; total: number; totalPages: number } {
    return {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private getTodayDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private getCurrentPublishTime(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(1970, 0, 1, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()),
    );
  }

  private combinePublishDateTime(publishDate: Date, publishTime: Date): Date {
    const combined = new Date(publishDate);
    const time = new Date(publishTime);

    combined.setUTCHours(
      time.getUTCHours(),
      time.getUTCMinutes(),
      time.getUTCSeconds(),
      0,
    );

    return combined;
  }

  private generateOtp(): string {
    return randomInt(100000, 1000000).toString();
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private getOtpExpiryDate(): Date {
    const otpExpiresIn = (this.configService.get<string>('mail.otpExpiresIn') ??
      '10m') as StringValue;
    const ttl = ms(otpExpiresIn);

    if (typeof ttl !== 'number') {
      throw new Error(`Invalid OTP_EXPIRES_IN value: ${otpExpiresIn}`);
    }

    return new Date(Date.now() + ttl);
  }

  private getOtpExpiresInMinutes(): number {
    const otpExpiresIn = (this.configService.get<string>('mail.otpExpiresIn') ??
      '10m') as StringValue;
    const ttl = ms(otpExpiresIn);

    if (typeof ttl !== 'number') {
      return 10;
    }

    return Math.max(1, Math.round(ttl / 60000));
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');

    if (!localPart || !domain) {
      return email;
    }

    if (localPart.length <= 1) {
      return `*@${domain}`;
    }

    return `${localPart[0]}***@${domain}`;
  }

  private ensureParentRole(user: AuthenticatedParent): void {
    if (user.role !== 'parent') {
      throw new ForbiddenException('Only parents can use this endpoint');
    }
  }

  private async findParentAccountByUsername(username: string) {
    return this.prisma.person.findFirst({
      where: {
        username,
        status: true,
        parent: { isNot: null },
        email: { not: null },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
      },
    });
  }

  private async signPasswordResetToken(personId: number): Promise<string> {
    const payload: PasswordResetJwtPayload = {
      sub: personId.toString(),
      purpose: 'password-reset',
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: this.getPasswordResetExpiresIn(),
    });
  }

  private async verifyPasswordResetToken(resetToken: string): Promise<number> {
    try {
      const payload = await this.jwtService.verifyAsync<PasswordResetJwtPayload>(
        resetToken,
        {
          secret: this.configService.get<string>('jwt.secret'),
        },
      );

      if (payload.purpose !== 'password-reset') {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      const personId = parseInt(payload.sub, 10);

      if (!Number.isFinite(personId)) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      return personId;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired reset token');
    }
  }

  private getPasswordResetExpiresIn(): StringValue {
    return (this.configService.get<string>('jwt.passwordResetExpiresIn') ??
      '15m') as StringValue;
  }

  private getPasswordResetExpiresInMinutes(): number {
    const ttl = ms(this.getPasswordResetExpiresIn());

    if (typeof ttl !== 'number') {
      return 15;
    }

    return Math.max(1, Math.round(ttl / 60000));
  }

  private async validateCredentials(
    loginDto: ParentLoginDto,
  ): Promise<LoginParentPerson> {
    const candidates = await this.prisma.person.findMany({
      where: {
        username: loginDto.username,
        status: true,
        parent: { isNot: null },
      },
      include: {
        parent: {
          select: { id: true },
        },
      },
    });

    if (candidates.length === 0) {
      throw new UnauthorizedException('Invalid username or password');
    }

    for (const candidate of candidates) {
      let passwordMatches = false;

      try {
        passwordMatches = await bcrypt.compare(
          loginDto.password,
          candidate.password,
        );
      } catch {
        continue;
      }

      if (passwordMatches && candidate.parent) {
        return candidate as LoginParentPerson;
      }
    }

    throw new UnauthorizedException('Invalid username or password');
  }

  private async createSession(person: LoginParentPerson) {
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    await this.prisma.parentSession.deleteMany({
      where: { personId: person.id },
    });

    const session = await this.prisma.parentSession.create({
      data: {
        personId: person.id,
        refreshTokenHash: this.hashToken(refreshToken),
        refreshExpiresAt,
      },
    });

    await this.sessionService.cleanupExpiredSessions();

    return this.buildTokenResponse(person, session.id, refreshToken);
  }

  private buildTokenResponse(
    person: LoginParentPerson,
    sessionId: string,
    refreshToken: string,
  ) {
    const payload: JwtPayload = {
      sub: person.id.toString(),
      username: person.username,
      role: 'parent',
      parentId: person.parent.id,
      sid: sessionId,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.getAccessExpiresIn(),
    });

    const decoded = this.jwtService.decode(accessToken);

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('exp' in decoded) ||
      typeof decoded.exp !== 'number'
    ) {
      throw new UnauthorizedException('Failed to create access token');
    }

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(decoded.exp * 1000).toISOString(),
      refreshTokenExpiresAt: this.getRefreshExpiryDate().toISOString(),
    };
  }

  private mapChildDetail(student: {
    id: number;
    motherName: string | null;
    motherFamily: string | null;
    motherPhone: string | null;
    person: {
      id: number;
      registerId: number | null;
      username: string;
      firstName: string;
      middleName: string;
      lastName: string;
      email: string | null;
      gender: number | null;
      birthday: Date | null;
      schoolId: number | null;
      school: { id: number; name: string } | null;
    };
    registrations: Array<{
      section: {
        id: number;
        class: { className: string };
        sectionTitle: { title: string };
        year: { title: string };
        school: { id: number; name: string };
      };
    }>;
  }): ParentMeChildDetailResponseDto {
    const registration = student.registrations[0];
    const school = student.person.school;

    return {
      studentId: student.id,
      personId: student.person.id,
      registerId: student.person.registerId,
      username: student.person.username,
      firstName: student.person.firstName,
      middleName: student.person.middleName,
      lastName: student.person.lastName,
      name: this.formatFullName(student.person),
      email: student.person.email,
      gender: student.person.gender,
      birthday: student.person.birthday?.toISOString() ?? null,
      schoolId: school?.id ?? student.person.schoolId!,
      schoolName: school?.name ?? '',
      motherName: student.motherName,
      motherFamily: student.motherFamily,
      motherPhone: student.motherPhone,
      registration: registration
        ? {
            sectionId: registration.section.id,
            className: registration.section.class.className,
            sectionTitle: registration.section.sectionTitle.title,
            yearTitle: registration.section.year.title,
            schoolId: registration.section.school.id,
            schoolName: registration.section.school.name,
          }
        : null,
    };
  }

  private async findSessionByRefreshToken(refreshToken: string) {
    return this.prisma.parentSession.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
    });
  }

  private async findLoginParentPerson(
    personId: number,
  ): Promise<LoginParentPerson | null> {
    const person = await this.prisma.person.findFirst({
      where: {
        id: personId,
        status: true,
        parent: { isNot: null },
      },
      include: {
        parent: {
          select: { id: true },
        },
      },
    });

    return person as LoginParentPerson | null;
  }

  private async revokeParentSessions(personId: number): Promise<void> {
    await this.prisma.parentSession.deleteMany({
      where: { personId },
    });

    await this.sessionService.cleanupExpiredSessions();
  }

  private formatFullName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .filter(Boolean)
      .join(' ');
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getAccessExpiresIn(): StringValue {
    return (this.configService.get<string>('jwt.accessExpiresIn') ??
      '15m') as StringValue;
  }

  private getRefreshExpiryDate(): Date {
    const refreshExpiresIn = (this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) ?? '7d') as StringValue;
    const ttl = ms(refreshExpiresIn);

    if (typeof ttl !== 'number') {
      throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN value: ${refreshExpiresIn}`);
    }

    return new Date(Date.now() + ttl);
  }
}

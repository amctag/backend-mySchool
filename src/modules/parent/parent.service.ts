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
} from '../../auth/interfaces/jwt-payload.interface';
import { SessionService } from '../../auth/services/session.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { ParentChangePasswordRequestOtpResponseDto } from './dto/parent-change-password-request-otp-response.dto';
import { ParentChangePasswordResponseDto } from './dto/parent-change-password-response.dto';
import { ParentChangePasswordDto } from './dto/parent-change-password.dto';
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

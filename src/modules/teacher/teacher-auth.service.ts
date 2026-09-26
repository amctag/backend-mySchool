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
import { createHash, randomBytes } from 'crypto';
import ms from 'ms';
import type { StringValue } from 'ms';
import {
  AuthenticatedTeacher,
  TeacherJwtPayload,
} from '../../auth/interfaces/jwt-payload.interface';
import { SessionService } from '../../auth/services/session.service';
import { FcmTokenStore } from '../../fcm/fcm-token.store';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SchoolService } from '../school/school.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  TeacherLoginDto,
  TeacherLoginResponseDto,
  TeacherLogoutResponseDto,
  TeacherRefreshResponseDto,
  TeacherTokenResponseDto,
} from './dto/teacher-auth.dto';
import {
  TeacherChangePasswordDto,
  TeacherChangePasswordResponseDto,
  TeacherMeResponseDto,
} from './dto/teacher-profile.dto';
import { TeacherSchoolDetailsResponseDto } from './dto/teacher-school-details-response.dto';
import { TeacherSupportSchoolsDto } from './dto/teacher-support-schools.dto';
import { formatFullName } from './teacher.util';

type LoginTeacherPerson = {
  id: number;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  paid: boolean;
  status: boolean;
  teacher: { id: number };
};

@Injectable()
export class TeacherAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly teacherAccess: TeacherAccessService,
    private readonly schoolService: SchoolService,
    private readonly fcmTokens: FcmTokenStore,
  ) {}

  async login(loginDto: TeacherLoginDto): Promise<TeacherLoginResponseDto> {
    const person = await this.validateCredentials(loginDto);
    const school = await this.resolveSchool(person.teacher.id, loginDto.schoolId);
    const tokens = await this.createSession(person, school.id);
    const fcmToken = loginDto.fcmToken?.trim();
    if (fcmToken) {
      await this.fcmTokens.save(person.id, fcmToken);
    }

    const supervised = await this.prisma.teacherSupervisor.findMany({
      where: {
        teacherId: person.teacher.id,
        class: { stage: { schoolId: school.id } },
      },
      select: { classId: true, yearId: true },
    });
    const sections =
      supervised.length === 0
        ? []
        : await this.prisma.section.findMany({
            where: {
              schoolId: school.id,
              OR: supervised.map((row) => ({
                classId: row.classId,
                yearId: row.yearId,
              })),
            },
            select: { id: true },
          });
    const supervisedClassIds = [...new Set(sections.map((row) => row.id))];

    return {
      ...tokens,
      teacherId: person.teacher.id,
      personId: person.id,
      schoolId: school.id,
      schoolName: school.name,
      username: person.username,
      name: formatFullName(person),
      email: person.email,
      phoneNumber: person.phoneNumber,
      roles: ['teacher'],
      isSupervisor: supervisedClassIds.length > 0,
      supervisedClassIds,
    };
  }

  async refresh(refreshToken: string): Promise<TeacherRefreshResponseDto> {
    const session = await this.prisma.teacherSession.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    if (!session || session.refreshExpiresAt <= new Date()) {
      if (session) {
        await this.prisma.teacherSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const person = await this.findLoginTeacherPerson(session.personId);
    if (!person?.teacher) {
      await this.prisma.teacherSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const school = await this.prisma.teacherSchool.findFirst({
      where: {
        teacherId: person.teacher.id,
        schoolId: session.schoolId,
        isActive: true,
        school: { isActive: true },
      },
      select: { schoolId: true },
    });

    if (!school) {
      await this.prisma.teacherSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const newRefreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    await this.prisma.teacherSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hashToken(newRefreshToken),
        refreshExpiresAt,
      },
    });

    return this.buildTokenResponse(
      person,
      school.schoolId,
      session.id,
      newRefreshToken,
    );
  }

  async saveFcmToken(
    user: AuthenticatedTeacher,
    token: string,
  ): Promise<{ saved: true }> {
    this.teacherAccess.ensureTeacherRole(user);
    await this.fcmTokens.save(user.id, token);
    return { saved: true };
  }

  async logout(user: AuthenticatedTeacher): Promise<TeacherLogoutResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    await this.prisma.teacherSession.deleteMany({
      where: { id: user.sessionId, personId: user.id },
    });
    await this.sessionService.cleanupExpiredSessions();
    return { message: 'Logged out successfully' };
  }

  async getProfile(user: AuthenticatedTeacher): Promise<TeacherMeResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const person = await this.prisma.person.findFirst({
      where: {
        id: user.id,
        status: true,
        teacher: { id: user.teacherId },
      },
      include: {
        teacher: {
          include: {
            schools: {
              where: { schoolId: user.schoolId, isActive: true },
              include: { school: { select: { id: true, name: true } } },
              take: 1,
            },
          },
        },
      },
    });

    const school = person?.teacher?.schools[0]?.school;
    if (!person?.teacher || !school) {
      throw new NotFoundException('Teacher not found');
    }

    const supervisedClassIds =
      await this.teacherAccess.supervisedSectionIds(user);

    return {
      personId: person.id,
      teacherId: person.teacher.id,
      schoolId: school.id,
      schoolName: school.name,
      username: person.username,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      name: formatFullName(person),
      email: person.email,
      phoneNumber: person.phoneNumber,
      roles: ['teacher'],
      isSupervisor: supervisedClassIds.length > 0,
      supervisedClassIds,
    };
  }

  async changePassword(
    user: AuthenticatedTeacher,
    dto: TeacherChangePasswordDto,
  ): Promise<TeacherChangePasswordResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const person = await this.prisma.person.findFirst({
      where: {
        id: user.id,
        status: true,
        teacher: { id: user.teacherId },
      },
      select: { id: true, password: true },
    });

    if (!person) {
      throw new NotFoundException('Teacher not found');
    }

    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      person.password,
    );
    if (!currentMatches) {
      throw new UnauthorizedException('Invalid current password');
    }

    await this.prisma.person.update({
      where: { id: person.id },
      data: { password: await bcrypt.hash(dto.newPassword, 10) },
    });

    return { message: 'Password changed successfully' };
  }

  async getSupportSchools(
    dto: TeacherSupportSchoolsDto,
  ): Promise<TeacherSchoolDetailsResponseDto> {
    let person = await this.prisma.person.findFirst({
      where: {
        id: dto.id,
        teacher: { isNot: null },
      },
      select: {
        id: true,
        teacher: { select: { id: true } },
      },
    });

    if (!person?.teacher) {
      const teacherById = await this.prisma.teacher.findUnique({
        where: { id: dto.id },
        select: {
          id: true,
          person: { select: { id: true } },
        },
      });

      if (teacherById?.person) {
        person = {
          id: teacherById.person.id,
          teacher: { id: teacherById.id },
        };
      }
    }

    if (!person?.teacher) {
      throw new NotFoundException('No teacher account found for this ID.');
    }

    const schoolLinks = await this.prisma.teacherSchool.findMany({
      where: {
        teacherId: person.teacher.id,
        isActive: true,
        school: { isActive: true },
      },
      select: { schoolId: true },
      orderBy: { id: 'asc' },
    });

    const schoolIds = [
      ...new Set(schoolLinks.map((link) => link.schoolId)),
    ];

    if (schoolIds.length === 0) {
      throw new NotFoundException(
        'No school is linked to this teacher account yet.',
      );
    }

    const schools = await this.schoolService.getSchoolDetailsForSchoolIds(
      schoolIds,
    );

    if (schools.length === 0) {
      throw new NotFoundException(
        'No school contact details were found for this ID.',
      );
    }

    return { schools };
  }

  private async validateCredentials(
    loginDto: TeacherLoginDto,
  ): Promise<LoginTeacherPerson> {
    // Accept either persons.id or teachers.id (same as support lookup).
    // Do not require status here — after password check we return a distinct
    // 403 so the app can prompt the teacher to contact support.
    let person = await this.prisma.person.findFirst({
      where: {
        id: loginDto.id,
        teacher: { isNot: null },
      },
      include: {
        teacher: { select: { id: true } },
      },
    });

    if (!person?.teacher) {
      const teacherById = await this.prisma.teacher.findUnique({
        where: { id: loginDto.id },
        select: {
          id: true,
          person: true,
        },
      });

      if (teacherById?.person) {
        person = {
          ...teacherById.person,
          teacher: { id: teacherById.id },
        };
      }
    }

    if (!person?.teacher) {
      throw new UnauthorizedException('Invalid ID or password');
    }

    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(
        loginDto.password,
        person.password,
      );
    } catch {
      passwordMatches = false;
    }

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid ID or password');
    }

    if (!person.paid) {
      throw new ForbiddenException(
        'Payment is required. Contact support for help.',
      );
    }
    if (!person.status) {
      throw new ForbiddenException(
        'This account is inactive. Contact support for help.',
      );
    }

    return person as LoginTeacherPerson;
  }

  private async resolveSchool(teacherId: number, schoolId?: number) {
    const schoolLink = await this.prisma.teacherSchool.findFirst({
      where: {
        teacherId,
        isActive: true,
        school: { isActive: true },
        ...(schoolId ? { schoolId } : {}),
      },
      include: { school: { select: { id: true, name: true } } },
      orderBy: { id: 'asc' },
    });

    if (!schoolLink) {
      throw new ForbiddenException(
        schoolId
          ? 'Teacher is not active in the requested school. Contact support for help.'
          : 'This account is inactive. Contact support for help.',
      );
    }

    return schoolLink.school;
  }

  private async createSession(
    person: LoginTeacherPerson,
    schoolId: number,
  ): Promise<TeacherTokenResponseDto> {
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    const session = await this.prisma.teacherSession.create({
      data: {
        personId: person.id,
        schoolId,
        refreshTokenHash: this.hashToken(refreshToken),
        refreshExpiresAt,
      },
    });

    await this.sessionService.cleanupExpiredSessions();

    return this.buildTokenResponse(person, schoolId, session.id, refreshToken);
  }

  private buildTokenResponse(
    person: LoginTeacherPerson,
    schoolId: number,
    sessionId: string,
    refreshToken: string,
  ): TeacherTokenResponseDto {
    const payload: TeacherJwtPayload = {
      sub: person.id.toString(),
      username: person.username,
      role: 'teacher',
      teacherId: person.teacher.id,
      schoolId,
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

  private async findLoginTeacherPerson(
    personId: number,
  ): Promise<LoginTeacherPerson | null> {
    const person = await this.prisma.person.findFirst({
      where: {
        id: personId,
        status: true,
        teacher: { isNot: null },
      },
      include: {
        teacher: { select: { id: true } },
      },
    });

    return person as LoginTeacherPerson | null;
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
    ) ?? '90d') as StringValue;
    const ttl = ms(refreshExpiresIn);

    if (typeof ttl !== 'number') {
      throw new Error(`Invalid JWT_REFRESH_EXPIRES_IN value: ${refreshExpiresIn}`);
    }

    return new Date(Date.now() + ttl);
  }
}

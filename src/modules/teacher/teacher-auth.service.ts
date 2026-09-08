import {
  BadRequestException,
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
import { PrismaService } from '../../database/prisma/prisma.service';
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
import { formatFullName } from './teacher.util';

type LoginTeacherPerson = {
  id: number;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
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
  ) {}

  async login(loginDto: TeacherLoginDto): Promise<TeacherLoginResponseDto> {
    const person = await this.validateCredentials(loginDto);
    const school = await this.resolveSchool(person.teacher.id, loginDto.schoolId);
    const tokens = await this.createSession(person, school.id);
    const fcmToken = loginDto.fcmToken?.trim();
    if (fcmToken) {
      await this.prisma.fcmToken.upsert({
        where: { personId: person.id },
        create: { personId: person.id, token: fcmToken },
        update: { token: fcmToken },
      });
    }

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

  async logout(user: AuthenticatedTeacher): Promise<TeacherLogoutResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    await this.revokeTeacherSessions(user.id);
    await this.prisma.fcmToken.deleteMany({ where: { personId: user.id } });
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

  private async validateCredentials(
    loginDto: TeacherLoginDto,
  ): Promise<LoginTeacherPerson> {
    const candidates = await this.prisma.person.findMany({
      where: {
        username: { equals: loginDto.username, mode: 'insensitive' },
        status: true,
        teacher: { isNot: null },
      },
      include: {
        teacher: { select: { id: true } },
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

      if (passwordMatches && candidate.teacher) {
        return candidate as LoginTeacherPerson;
      }
    }

    throw new UnauthorizedException('Invalid username or password');
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
      throw new UnauthorizedException(
        schoolId
          ? 'Teacher is not active in the requested school'
          : 'Teacher is not assigned to an active school',
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

    await this.prisma.teacherSession.deleteMany({
      where: { personId: person.id },
    });

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

  private async revokeTeacherSessions(personId: number): Promise<void> {
    await this.prisma.teacherSession.deleteMany({ where: { personId } });
    await this.sessionService.cleanupExpiredSessions();
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

import {
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
  AuthenticatedSchool,
  SchoolJwtPayload,
} from '../../auth/interfaces/jwt-payload.interface';
import { SessionService } from '../../auth/services/session.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SchoolAccessTokenResponseDto } from './dto/school-access-token-response.dto';
import { SchoolLoginDto } from './dto/school-login.dto';
import { SchoolMeResponseDto } from './dto/school-me-response.dto';

type SchoolAdminPerson = {
  id: number;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string | null;
  schoolId: number;
  school: { id: number; name: string };
};

type SchoolAuthResult = {
  access: SchoolAccessTokenResponseDto;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

@Injectable()
export class SchoolAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {}

  async login(loginDto: SchoolLoginDto): Promise<SchoolAuthResult> {
    const person = await this.validateCredentials(loginDto);
    return this.createSession(person);
  }

  async refresh(refreshToken: string | undefined): Promise<SchoolAuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const session = await this.prisma.parentSession.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    if (!session || session.refreshExpiresAt <= new Date()) {
      if (session) {
        await this.prisma.parentSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const person = await this.findSchoolAdminPerson(session.personId);

    if (!person) {
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

    return {
      access: this.buildAccessResponse(person, session.id),
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    };
  }

  async logout(user: AuthenticatedSchool): Promise<void> {
    await this.prisma.parentSession.deleteMany({
      where: { personId: user.id },
    });
    await this.sessionService.cleanupExpiredSessions();
  }

  async getProfile(user: AuthenticatedSchool): Promise<SchoolMeResponseDto> {
    const person = await this.findSchoolAdminPerson(user.id);

    if (!person) {
      throw new NotFoundException('School admin not found');
    }

    return {
      personId: person.id,
      username: person.username,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      name: this.formatFullName(person),
      email: person.email,
      schoolId: person.school.id,
      schoolName: person.school.name,
      role: 'school',
    };
  }

  private async validateCredentials(
    loginDto: SchoolLoginDto,
  ): Promise<SchoolAdminPerson> {
    const email = loginDto.email.trim().toLowerCase();
    const candidates = await this.prisma.person.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        status: true,
        schoolId: { not: null },
        parent: { is: null },
        teacher: { is: null },
        student: { is: null },
      },
      include: {
        school: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

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

      if (
        passwordMatches &&
        candidate.schoolId &&
        candidate.school?.isActive
      ) {
        return {
          id: candidate.id,
          username: candidate.username,
          firstName: candidate.firstName,
          middleName: candidate.middleName,
          lastName: candidate.lastName,
          email: candidate.email,
          schoolId: candidate.schoolId,
          school: { id: candidate.school.id, name: candidate.school.name },
        };
      }
    }

    throw new UnauthorizedException('Invalid email or password');
  }

  private async createSession(
    person: SchoolAdminPerson,
  ): Promise<SchoolAuthResult> {
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

    return {
      access: this.buildAccessResponse(person, session.id),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    };
  }

  private buildAccessResponse(
    person: SchoolAdminPerson,
    sessionId: string,
  ): SchoolAccessTokenResponseDto {
    const payload: SchoolJwtPayload = {
      sub: person.id.toString(),
      username: person.username,
      role: 'school',
      schoolId: person.schoolId,
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
      accessTokenExpiresAt: new Date(decoded.exp * 1000).toISOString(),
      name: this.formatFullName(person),
      schoolId: person.schoolId,
      schoolName: person.school.name,
    };
  }

  private async findSchoolAdminPerson(
    personId: number,
  ): Promise<SchoolAdminPerson | null> {
    const person = await this.prisma.person.findFirst({
      where: {
        id: personId,
        status: true,
        schoolId: { not: null },
        parent: { is: null },
        teacher: { is: null },
        student: { is: null },
      },
      include: {
        school: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!person?.schoolId || !person.school?.isActive) {
      return null;
    }

    return {
      id: person.id,
      username: person.username,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      email: person.email,
      schoolId: person.schoolId,
      school: { id: person.school.id, name: person.school.name },
    };
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
      throw new Error(
        `Invalid JWT_REFRESH_EXPIRES_IN value: ${refreshExpiresIn}`,
      );
    }

    return new Date(Date.now() + ttl);
  }
}

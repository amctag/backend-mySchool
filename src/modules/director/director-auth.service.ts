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
import ms from 'ms';
import type { StringValue } from 'ms';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SessionService } from '../../auth/services/session.service';
import { SchoolService } from '../school/school.service';
import {
  DirectorLoginDto,
  DirectorLoginResponseDto,
  DirectorLogoutResponseDto,
  DirectorRefreshDto,
  DirectorRefreshResponseDto,
  DirectorTokenResponseDto,
  DirectorMeResponseDto,
} from './dto/director-auth.dto';
import { formatFullName } from './director.util';
import { DirectorAccessService } from './director-access.service';
import { AuthenticatedDirector, DirectorJwtPayload } from '../../auth/interfaces/jwt-payload.interface';

type LoginDirectorPerson = {
  id: number;
  username: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string | null;
  phoneNumber: string | null;
  status: boolean;
  paid: boolean;
  director: { id: number };
};

@Injectable()
export class DirectorAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
    private readonly directorAccess: DirectorAccessService,
    private readonly schoolService: SchoolService,
  ) {}

  async login(loginDto: DirectorLoginDto): Promise<DirectorLoginResponseDto> {
    const person = await this.validateCredentials(loginDto);
    const school = await this.resolveSchool(person.director.id, loginDto.schoolId);
    const tokens = await this.createSession(person, school.id);
    const fcmToken = loginDto.fcmToken?.trim();
    if (fcmToken) {
      // TODO: Add FCM token storage for director when needed
    }

    return {
      ...tokens,
      directorId: person.director.id,
      personId: person.id,
      schoolId: school.id,
      schoolName: school.name,
      username: person.username,
      name: formatFullName(person),
      email: person.email,
      phoneNumber: person.phoneNumber,
      roles: ['director'],
    };
  }

  async refresh(refreshToken: string): Promise<DirectorRefreshResponseDto> {
    const session = await this.prisma.directorSession.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    if (!session || session.refreshExpiresAt <= new Date()) {
      if (session) {
        await this.prisma.directorSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const person = await this.findLoginDirectorPerson(session.personId);
    if (!person?.director) {
      await this.prisma.directorSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const school = await this.prisma.directorSchool.findFirst({
      where: {
        directorId: person.director.id,
        schoolId: session.schoolId,
        isActive: true,
        school: { isActive: true },
      },
      select: { schoolId: true },
    });

    if (!school) {
      await this.prisma.directorSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const newRefreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    await this.prisma.directorSession.update({
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

  async logout(user: AuthenticatedDirector): Promise<DirectorLogoutResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);
    await this.prisma.directorSession.deleteMany({
      where: { personId: user.id },
    });
    await this.sessionService.cleanupExpiredSessions();
    return { message: 'Logged out successfully' };
  }

  async getProfile(user: AuthenticatedDirector): Promise<DirectorMeResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const person = await this.prisma.person.findFirst({
      where: {
        id: user.id,
        status: true,
        director: { id: user.directorId },
      },
      include: {
        director: {
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

    const school = person?.director?.schools[0]?.school;
    if (!person?.director || !school) {
      throw new NotFoundException('Director not found');
    }

    return {
      directorId: person.director.id,
      personId: person.id,
      schoolId: school.id,
      schoolName: school.name,
      username: person.username,
      name: formatFullName(person),
      email: person.email,
      phoneNumber: person.phoneNumber,
      roles: ['director'],
    };
  }

  async saveFcmToken(
    user: AuthenticatedDirector,
    token: string,
  ): Promise<{ saved: true }> {
    // Director FCM token storage - can be implemented later
    return { saved: true };
  }

  private async validateCredentials(
    loginDto: DirectorLoginDto,
  ): Promise<LoginDirectorPerson> {
    let person = await this.prisma.person.findFirst({
      where: {
        id: loginDto.id,
        director: { isNot: null },
      },
      include: {
        director: {
          include: {
            schools: {
              where: { isActive: true },
              include: { school: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    if (!person?.director) {
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

    return {
      id: person.id,
      username: person.username,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      email: person.email,
      phoneNumber: person.phoneNumber,
      status: person.status,
      paid: person.paid,
      director: person.director,
    };
  }

  private async resolveSchool(directorId: number, schoolId?: number) {
    const schoolLink = await this.prisma.directorSchool.findFirst({
      where: {
        directorId,
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
          ? 'Director is not active in the requested school. Contact support for help.'
          : 'This account is inactive. Contact support for help.',
      );
    }

    return schoolLink.school;
  }

  private async createSession(
    person: LoginDirectorPerson,
    schoolId: number,
  ): Promise<DirectorTokenResponseDto> {
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    const session = await this.prisma.directorSession.create({
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
    person: LoginDirectorPerson,
    schoolId: number,
    sessionId: string,
    refreshToken: string,
  ): DirectorTokenResponseDto {
    const payload: DirectorJwtPayload = {
      sub: person.id.toString(),
      username: person.username,
      role: 'director',
      directorId: person.director.id,
      personId: person.id,
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

  private async findLoginDirectorPerson(
    personId: number,
  ): Promise<LoginDirectorPerson | null> {
    const person = await this.prisma.person.findFirst({
      where: {
        id: personId,
        status: true,
        director: { isNot: null },
      },
      include: {
        director: {
          select: { id: true },
        },
      },
    });

    if (!person?.director) {
      return null;
    }

    return {
      id: person.id,
      username: person.username,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      email: person.email,
      phoneNumber: person.phoneNumber,
      status: person.status,
      paid: person.paid,
      director: person.director,
    };
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
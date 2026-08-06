import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import ms from 'ms';
import type { StringValue } from 'ms';
import { PrismaService } from '../database/prisma/prisma.service';
import { ParentLoginResponseDto } from './dto/parent-login-response.dto';
import { ParentLoginDto } from './dto/parent-login.dto';
import { ParentLogoutResponseDto } from './dto/parent-logout-response.dto';
import { ParentRefreshResponseDto } from './dto/parent-refresh-response.dto';
import {
  AuthenticatedParent,
  JwtPayload,
} from './interfaces/jwt-payload.interface';

type ParentPerson = {
  id: number;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string | null;
  schoolId: number | null;
  parent: {
    id: number;
    students: Array<{
      id: number;
      person: {
        id: number;
        firstName: string;
        lastName: string;
        username: string;
        schoolId: number | null;
      };
    }>;
  };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async parentLogin(loginDto: ParentLoginDto): Promise<ParentLoginResponseDto> {
    const person = await this.validateParentCredentials(loginDto);
    const tokens = await this.createSession(person);

    return {
      ...tokens,
      parent: this.mapParentProfile(person),
      children: this.mapChildren(person),
    };
  }

  async parentRefresh(refreshToken: string): Promise<ParentRefreshResponseDto> {
    const session = await this.findSessionByRefreshToken(refreshToken);

    if (!session || session.refreshExpiresAt <= new Date()) {
      if (session) {
        await this.prisma.parentSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const person = await this.findParentPerson(session.personId);

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

  async parentLogout(user: AuthenticatedParent): Promise<ParentLogoutResponseDto> {
    if (user.role !== 'parent') {
      throw new ForbiddenException('Only parents can use this endpoint');
    }

    await this.prisma.parentSession.deleteMany({
      where: {
        id: user.sessionId,
        personId: user.id,
      },
    });

    await this.cleanupExpiredSessions();

    return { message: 'Logged out successfully' };
  }

  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.prisma.parentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return false;
    }

    if (session.refreshExpiresAt <= new Date()) {
      await this.prisma.parentSession.delete({ where: { id: sessionId } });
      return false;
    }

    return true;
  }

  private async validateParentCredentials(
    loginDto: ParentLoginDto,
  ): Promise<ParentPerson> {
    const candidates = await this.prisma.person.findMany({
      where: {
        username: loginDto.username,
        status: true,
        parent: { isNot: null },
      },
      include: {
        parent: {
          include: {
            students: {
              include: {
                person: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    schoolId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (candidates.length === 0) {
      throw new UnauthorizedException('Invalid username or password');
    }

    for (const candidate of candidates) {
      const passwordMatches = await bcrypt.compare(
        loginDto.password,
        candidate.password,
      );

      if (passwordMatches && candidate.parent) {
        return candidate as ParentPerson;
      }
    }

    throw new UnauthorizedException('Invalid username or password');
  }

  private async createSession(person: ParentPerson) {
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    const session = await this.prisma.parentSession.create({
      data: {
        personId: person.id,
        refreshTokenHash: this.hashToken(refreshToken),
        refreshExpiresAt,
      },
    });

    await this.cleanupExpiredSessions();

    return this.buildTokenResponse(person, session.id, refreshToken);
  }

  private buildTokenResponse(
    person: ParentPerson,
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

  private async findSessionByRefreshToken(refreshToken: string) {
    return this.prisma.parentSession.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
    });
  }

  private async findParentPerson(personId: number): Promise<ParentPerson | null> {
    const person = await this.prisma.person.findFirst({
      where: {
        id: personId,
        status: true,
        parent: { isNot: null },
      },
      include: {
        parent: {
          include: {
            students: {
              include: {
                person: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    username: true,
                    schoolId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return person as ParentPerson | null;
  }

  private mapParentProfile(person: ParentPerson) {
    return {
      personId: person.id,
      parentId: person.parent.id,
      username: person.username,
      firstName: person.firstName,
      middleName: person.middleName,
      lastName: person.lastName,
      email: person.email,
      schoolId: person.schoolId,
    };
  }

  private mapChildren(person: ParentPerson) {
    return person.parent.students.map((student) => ({
      studentId: student.id,
      personId: student.person.id,
      firstName: student.person.firstName,
      lastName: student.person.lastName,
      username: student.person.username,
      schoolId: student.person.schoolId,
    }));
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

  private async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.parentSession.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
    });
  }
}

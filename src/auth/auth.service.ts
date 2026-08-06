import {
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
import { PrismaService } from '../database/prisma/prisma.service';
import { ParentLoginResponseDto } from './dto/parent-login-response.dto';
import { ParentLoginDto } from './dto/parent-login.dto';
import { ParentLogoutResponseDto } from './dto/parent-logout-response.dto';
import { ParentMeResponseDto } from './dto/parent-me-response.dto';
import { ParentRefreshResponseDto } from './dto/parent-refresh-response.dto';
import {
  AuthenticatedParent,
  JwtPayload,
} from './interfaces/jwt-payload.interface';

type LoginParentPerson = {
  id: number;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  parent: { id: number };
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
      name: this.formatFullName(person),
    };
  }

  async parentMe(user: AuthenticatedParent): Promise<ParentMeResponseDto> {
    if (user.role !== 'parent') {
      throw new ForbiddenException('Only parents can use this endpoint');
    }

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
      schoolId: person.schoolId,
      childrenCount: person.parent._count.students,
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
      const passwordMatches = await bcrypt.compare(
        loginDto.password,
        candidate.password,
      );

      if (passwordMatches && candidate.parent) {
        return candidate as LoginParentPerson;
      }
    }

    throw new UnauthorizedException('Invalid username or password');
  }

  private async createSession(person: LoginParentPerson) {
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

  private async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.parentSession.deleteMany({
      where: { refreshExpiresAt: { lt: new Date() } },
    });
  }
}

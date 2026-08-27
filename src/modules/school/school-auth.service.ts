import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
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

type SchoolAccount = {
  id: number;
  name: string;
  email: string;
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
    const school = await this.validateCredentials(loginDto);
    return this.createSession(school);
  }

  async refresh(refreshToken: string | undefined): Promise<SchoolAuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const school = await this.prisma.school.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
    });

    if (
      !school ||
      !school.sessionId ||
      !school.refreshExpiresAt ||
      school.refreshExpiresAt <= new Date()
    ) {
      if (school) {
        await this.clearSession(school.id);
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!school.isActive) {
      await this.clearSession(school.id);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const newRefreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();

    await this.prisma.school.update({
      where: { id: school.id },
      data: {
        refreshTokenHash: this.hashToken(newRefreshToken),
        refreshExpiresAt,
      },
    });

    return {
      access: this.buildAccessResponse(
        { id: school.id, name: school.name, email: school.email },
        school.sessionId,
      ),
      refreshToken: newRefreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    };
  }

  async logout(user: AuthenticatedSchool): Promise<void> {
    await this.clearSession(user.schoolId);
    await this.sessionService.cleanupExpiredSessions();
  }

  async getProfile(user: AuthenticatedSchool): Promise<SchoolMeResponseDto> {
    const school = await this.prisma.school.findFirst({
      where: { id: user.schoolId, isActive: true },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    return {
      schoolId: school.id,
      name: school.name,
      email: school.email,
      role: 'school',
    };
  }

  private async validateCredentials(
    loginDto: SchoolLoginDto,
  ): Promise<SchoolAccount> {
    const email = loginDto.email.trim().toLowerCase();
    const school = await this.prisma.school.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (!school) {
      throw new UnauthorizedException('Invalid email or password');
    }

    let passwordMatches = false;

    try {
      passwordMatches = await bcrypt.compare(loginDto.password, school.password);
    } catch {
      passwordMatches = false;
    }

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: school.id,
      name: school.name,
      email: school.email,
    };
  }

  private async createSession(school: SchoolAccount): Promise<SchoolAuthResult> {
    const refreshToken = this.generateRefreshToken();
    const refreshExpiresAt = this.getRefreshExpiryDate();
    const sessionId = randomUUID();

    await this.prisma.school.update({
      where: { id: school.id },
      data: {
        sessionId,
        refreshTokenHash: this.hashToken(refreshToken),
        refreshExpiresAt,
      },
    });

    await this.sessionService.cleanupExpiredSessions();

    return {
      access: this.buildAccessResponse(school, sessionId),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    };
  }

  private async clearSession(schoolId: number): Promise<void> {
    await this.prisma.school.updateMany({
      where: { id: schoolId },
      data: {
        sessionId: null,
        refreshTokenHash: null,
        refreshExpiresAt: null,
      },
    });
  }

  private buildAccessResponse(
    school: SchoolAccount,
    sessionId: string,
  ): SchoolAccessTokenResponseDto {
    const payload: SchoolJwtPayload = {
      sub: school.id.toString(),
      username: school.email,
      role: 'school',
      schoolId: school.id,
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
      name: school.name,
      schoolId: school.id,
      schoolName: school.name,
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

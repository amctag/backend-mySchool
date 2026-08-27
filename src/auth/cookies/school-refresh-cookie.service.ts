import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

export const SCHOOL_REFRESH_COOKIE = 'school_rt';

@Injectable()
export class SchoolRefreshCookieService {
  constructor(private readonly configService: ConfigService) {}

  read(request: Request): string | undefined {
    const value = request.cookies?.[SCHOOL_REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  set(response: Response, refreshToken: string, expiresAt: Date): void {
    response.cookie(SCHOOL_REFRESH_COOKIE, refreshToken, this.options(expiresAt));
  }

  clear(response: Response): void {
    response.clearCookie(SCHOOL_REFRESH_COOKIE, this.options(new Date(0)));
  }

  private options(expiresAt: Date): CookieOptions {
    const isProduction = this.configService.get<string>('app.nodeEnv') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      // Lax lets same-site reloads POST /refresh. Cross-site browsers should
      // call the dashboard /api/v1 proxy instead of the API host directly.
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    };
  }
}

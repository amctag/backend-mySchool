import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'change-me',
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.username || !payload.sid) {
      throw new UnauthorizedException();
    }

    if (payload.role === 'parent' && payload.parentId) {
      return {
        id: Number(payload.sub),
        username: payload.username,
        role: 'parent',
        parentId: payload.parentId,
        sessionId: payload.sid,
      };
    }

    if (payload.role === 'school' && payload.schoolId) {
      return {
        id: Number(payload.sub),
        username: payload.username,
        role: 'school',
        schoolId: payload.schoolId,
        sessionId: payload.sid,
      };
    }

    throw new UnauthorizedException();
  }
}

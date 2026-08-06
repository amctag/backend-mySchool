import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedParent,
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

  validate(payload: JwtPayload): AuthenticatedParent {
    if (
      !payload.sub ||
      !payload.username ||
      payload.role !== 'parent' ||
      !payload.parentId
    ) {
      throw new UnauthorizedException();
    }

    return {
      id: Number(payload.sub),
      username: payload.username,
      role: 'parent',
      parentId: payload.parentId,
    };
  }
}

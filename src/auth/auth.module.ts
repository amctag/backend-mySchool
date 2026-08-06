import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { PrismaModule } from '../database/prisma/prisma.module';
import { SessionService } from './services/session.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.get<string>('jwt.secret') ?? 'change-me',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.accessExpiresIn') ??
            '15m') as StringValue,
        },
      }),
    }),
  ],
  providers: [JwtStrategy, SessionService],
  exports: [JwtModule, SessionService],
})
export class AuthModule {}

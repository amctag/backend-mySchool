import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig from './config/app.config';
import corsConfig from './config/cors.config';
import databaseConfig from './config/database.config';
import mailConfig from './config/mail.config';
import fcmConfig from './config/fcm.config';
import jwtConfig from './config/jwt.config';
import throttleConfig from './config/throttle.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './database/prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { FcmModule } from './fcm/fcm.module';
import { AuthModule } from './auth/auth.module';
import { ParentModule } from './modules/parent/parent.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { SchoolModule } from './modules/school/school.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        throttleConfig,
        corsConfig,
        mailConfig,
        fcmConfig,
      ],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        skipIf: () => configService.get<boolean>('throttle.disabled') === true,
        throttlers: [
          {
            name: 'default',
            ttl: configService.get<number>('throttle.ttl') ?? 60000,
            limit: configService.get<number>('throttle.limit') ?? 10000,
          },
        ],
      }),
    }),
    PrismaModule,
    MailModule,
    FcmModule,
    AuthModule,
    ParentModule,
    TeacherModule,
    SchoolModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

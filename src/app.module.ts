import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PeopleModule } from './modules/people/people.module';
import { AcademicModule } from './modules/academic/academic.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { AnnouncementModule } from './modules/announcement/announcement.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AlbumsModule } from './modules/albums/albums.module';
import { NoticesModule } from './modules/notices/notices.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { SchoolModule } from './modules/school/school.module';
import { ReportsModule } from './modules/reports/reports.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
    }),
    PrismaModule,
    AuthModule,
    PeopleModule,
    AcademicModule,
    AttendanceModule,
    AgendaModule,
    AnnouncementModule,
    ActivitiesModule,
    AlbumsModule,
    NoticesModule,
    TimetableModule,
    SchoolModule,
    ReportsModule,
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
  ],
})
export class AppModule {}

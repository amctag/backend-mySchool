import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { SchoolModule } from '../school/school.module';
import { ParentAuthController } from './parent-auth.controller';
import { ParentProfileController } from './parent-profile.controller';
import { ParentAnnouncementController } from './parent-announcement.controller';
import { ParentActivityController } from './parent-activity.controller';
import { ParentForgotPasswordController } from './parent-forgot-password.controller';
import { ParentPasswordController } from './parent-password.controller';
import { ParentAttendanceController } from './parent-attendance.controller';
import { ParentNoticeController } from './parent-notice.controller';
import { ParentAgendaController } from './parent-agenda.controller';
import { ParentAlbumController } from './parent-album.controller';
import { ParentExamScheduleController } from './parent-exam-schedule.controller';
import { ParentGradeController } from './parent-grade.controller';
import { ParentScheduleController } from './parent-schedule.controller';
import { ParentSchoolDetailsController } from './parent-school-details.controller';
import { ParentService } from './parent.service';

@Module({
  imports: [AuthModule, PrismaModule, SchoolModule],
  controllers: [
    ParentAuthController,
    ParentForgotPasswordController,
    ParentProfileController,
    ParentPasswordController,
    ParentSchoolDetailsController,
    ParentAnnouncementController,
    ParentActivityController,
    ParentAttendanceController,
    ParentNoticeController,
    ParentAgendaController,
    ParentAlbumController,
    ParentExamScheduleController,
    ParentGradeController,
    ParentScheduleController,
  ],
  providers: [ParentService],
})
export class ParentModule {}

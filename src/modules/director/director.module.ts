import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { SchoolModule } from '../school/school.module';
import { DirectorAuthController } from './director-auth.controller';
import { DirectorAuthService } from './director-auth.service';
import { DirectorAccessService } from './director-access.service';
import { DirectorClassesController } from './director-classes.controller';
import { DirectorClassesService } from './director-classes.service';
import { DirectorScheduleController } from './director-schedule.controller';
import { DirectorScheduleService } from './director-schedule.service';
import { DirectorGradesController } from './director-grades.controller';
import { DirectorGradesService } from './director-grades.service';
import { DirectorAttendanceController } from './director-attendance.controller';
import { DirectorAttendanceService } from './director-attendance.service';
import { DirectorAnnouncementsController } from './director-announcements.controller';
import { DirectorAnnouncementsService } from './director-announcements.service';
import { DirectorActivitiesController } from './director-activities.controller';
import { DirectorActivitiesService } from './director-activities.service';
import { DirectorNoticesController } from './director-notices.controller';
import { DirectorNoticesService } from './director-notices.service';
import { DirectorAlbumsController } from './director-albums.controller';
import { DirectorAlbumsService } from './director-albums.service';
import { DirectorTasksController } from './director-tasks.controller';
import { DirectorTasksService } from './director-tasks.service';
import { DirectorNotificationsController } from './director-notifications.controller';
import { DirectorNotificationsService } from './director-notifications.service';
import { DirectorAgendaController } from './director-agenda.controller';
import { DirectorAgendaService } from './director-agenda.service';
import { DirectorUploadsController } from './director-uploads.controller';
import { MediaUploadService } from '../../upload/media-upload.service';

@Module({
  imports: [AuthModule, PrismaModule, SchoolModule],
  controllers: [
    DirectorAuthController,
    DirectorClassesController,
    DirectorScheduleController,
    DirectorGradesController,
    DirectorAttendanceController,
    DirectorAnnouncementsController,
    DirectorActivitiesController,
    DirectorNoticesController,
    DirectorAlbumsController,
    DirectorTasksController,
    DirectorNotificationsController,
    DirectorAgendaController,
    DirectorUploadsController,
  ],
  providers: [
    DirectorAuthService,
    DirectorAccessService,
    DirectorClassesService,
    DirectorScheduleService,
    DirectorGradesService,
    DirectorAttendanceService,
    DirectorAnnouncementsService,
    DirectorActivitiesService,
    DirectorNoticesService,
    DirectorAlbumsService,
    DirectorTasksService,
    DirectorNotificationsService,
    DirectorAgendaService,
    MediaUploadService,
  ],
})
export class DirectorModule {}

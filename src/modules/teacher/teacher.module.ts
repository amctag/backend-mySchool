import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { TeacherAccessService } from './teacher-access.service';
import { TeacherAuthController } from './teacher-auth.controller';
import { TeacherAuthService } from './teacher-auth.service';
import { TeacherProfileController } from './teacher-profile.controller';
import { TeacherClassesController } from './teacher-classes.controller';
import { TeacherClassesService } from './teacher-classes.service';
import { TeacherAgendaController } from './teacher-agenda.controller';
import { TeacherAgendaService } from './teacher-agenda.service';
import { TeacherUploadsController } from './teacher-uploads.controller';
import { TeacherNoticesController } from './teacher-notices.controller';
import { TeacherNoticesService } from './teacher-notices.service';
import { TeacherScheduleController } from './teacher-schedule.controller';
import { TeacherScheduleService } from './teacher-schedule.service';
import { TeacherGradesController } from './teacher-grades.controller';
import { TeacherGradesService } from './teacher-grades.service';
import { MediaUploadService } from '../../upload/media-upload.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    TeacherAuthController,
    TeacherProfileController,
    TeacherScheduleController,
    TeacherClassesController,
    TeacherNoticesController,
    TeacherAgendaController,
    TeacherUploadsController,
    TeacherGradesController,
  ],
  providers: [
    TeacherAuthService,
    TeacherAccessService,
    TeacherScheduleService,
    TeacherClassesService,
    TeacherNoticesService,
    TeacherAgendaService,
    TeacherGradesService,
    MediaUploadService,
  ],
})
export class TeacherModule {}

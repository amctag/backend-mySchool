import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { DashboardAttendancesController } from './dashboard-attendances.controller';
import { DashboardAttendancesService } from './dashboard-attendances.service';
import { DashboardLookupsController } from './dashboard-lookups.controller';
import { DashboardLookupsService } from './dashboard-lookups.service';
import { DashboardChildrenController } from './dashboard-children.controller';
import { DashboardChildrenService } from './dashboard-children.service';
import { DashboardStudentsController } from './dashboard-students.controller';
import { DashboardStudentsService } from './dashboard-students.service';
import { DashboardTeachersController } from './dashboard-teachers.controller';
import { DashboardTeachersService } from './dashboard-teachers.service';
import { DashboardClassesController } from './dashboard-classes.controller';
import { DashboardClassesService } from './dashboard-classes.service';
import { DashboardCoursesController } from './dashboard-courses.controller';
import { DashboardCoursesService } from './dashboard-courses.service';
import { DashboardSectionsController } from './dashboard-sections.controller';
import { DashboardSectionsService } from './dashboard-sections.service';
import { DashboardTeachesController } from './dashboard-teaches.controller';
import { DashboardTeachesService } from './dashboard-teaches.service';
import { DashboardAnnouncementsController } from './dashboard-announcements.controller';
import { DashboardAnnouncementsService } from './dashboard-announcements.service';
import { DashboardWeeklySchedulesController } from './dashboard-weekly-schedules.controller';
import { DashboardWeeklySchedulesService } from './dashboard-weekly-schedules.service';
import { DashboardExamSchedulesController } from './dashboard-exam-schedules.controller';
import { DashboardExamSchedulesService } from './dashboard-exam-schedules.service';
import { DashboardRegistrationsController } from './dashboard-registrations.controller';
import { DashboardRegistrationsService } from './dashboard-registrations.service';
import { DashboardGradesController } from './dashboard-grades.controller';
import { DashboardGradesService } from './dashboard-grades.service';
import { DashboardGradeFormsController } from './dashboard-grade-forms.controller';
import { DashboardGradeFormsService } from './dashboard-grade-forms.service';
import { DashboardParentsController } from './dashboard-parents.controller';
import { DashboardParentsService } from './dashboard-parents.service';
import { DashboardScheduleGeneratorController } from './dashboard-schedule-generator.controller';
import { DashboardScheduleGeneratorService } from './dashboard-schedule-generator.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    DashboardParentsController,
    DashboardChildrenController,
    DashboardStudentsController,
    DashboardTeachersController,
    DashboardClassesController,
    DashboardCoursesController,
    DashboardSectionsController,
    DashboardTeachesController,
    DashboardAnnouncementsController,
    DashboardWeeklySchedulesController,
    DashboardExamSchedulesController,
    DashboardRegistrationsController,
    DashboardGradesController,
    DashboardGradeFormsController,
    DashboardAttendancesController,
    DashboardLookupsController,
    DashboardScheduleGeneratorController,
  ],
  providers: [
    DashboardParentsService,
    DashboardChildrenService,
    DashboardStudentsService,
    DashboardTeachersService,
    DashboardClassesService,
    DashboardCoursesService,
    DashboardSectionsService,
    DashboardTeachesService,
    DashboardAnnouncementsService,
    DashboardWeeklySchedulesService,
    DashboardExamSchedulesService,
    DashboardRegistrationsService,
    DashboardGradesService,
    DashboardGradeFormsService,
    DashboardAttendancesService,
    DashboardLookupsService,
    DashboardScheduleGeneratorService,
  ],
})
export class DashboardModule {}

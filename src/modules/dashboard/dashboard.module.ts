import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
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
import { DashboardParentsController } from './dashboard-parents.controller';
import { DashboardParentsService } from './dashboard-parents.service';

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
    DashboardLookupsController,
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
    DashboardLookupsService,
  ],
})
export class DashboardModule {}

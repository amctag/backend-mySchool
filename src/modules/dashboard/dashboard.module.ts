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
    DashboardLookupsController,
  ],
  providers: [
    DashboardParentsService,
    DashboardChildrenService,
    DashboardStudentsService,
    DashboardTeachersService,
    DashboardClassesService,
    DashboardLookupsService,
  ],
})
export class DashboardModule {}

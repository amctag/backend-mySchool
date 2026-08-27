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
import { DashboardParentsController } from './dashboard-parents.controller';
import { DashboardParentsService } from './dashboard-parents.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    DashboardParentsController,
    DashboardChildrenController,
    DashboardStudentsController,
    DashboardTeachersController,
    DashboardLookupsController,
  ],
  providers: [
    DashboardParentsService,
    DashboardChildrenService,
    DashboardStudentsService,
    DashboardTeachersService,
    DashboardLookupsService,
  ],
})
export class DashboardModule {}

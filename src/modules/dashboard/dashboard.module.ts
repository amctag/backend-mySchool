import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { DashboardLookupsController } from './dashboard-lookups.controller';
import { DashboardLookupsService } from './dashboard-lookups.service';
import { DashboardChildrenController } from './dashboard-children.controller';
import { DashboardChildrenService } from './dashboard-children.service';
import { DashboardParentsController } from './dashboard-parents.controller';
import { DashboardParentsService } from './dashboard-parents.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    DashboardParentsController,
    DashboardChildrenController,
    DashboardLookupsController,
  ],
  providers: [
    DashboardParentsService,
    DashboardChildrenService,
    DashboardLookupsService,
  ],
})
export class DashboardModule {}

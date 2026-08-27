import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { DashboardLookupsController } from './dashboard-lookups.controller';
import { DashboardLookupsService } from './dashboard-lookups.service';
import { DashboardParentsController } from './dashboard-parents.controller';
import { DashboardParentsService } from './dashboard-parents.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardParentsController, DashboardLookupsController],
  providers: [DashboardParentsService, DashboardLookupsService],
})
export class DashboardModule {}

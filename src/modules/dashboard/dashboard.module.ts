import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { DashboardParentsController } from './dashboard-parents.controller';
import { DashboardParentsService } from './dashboard-parents.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardParentsController],
  providers: [DashboardParentsService],
})
export class DashboardModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { ParentAuthController } from './parent-auth.controller';
import { ParentProfileController } from './parent-profile.controller';
import { ParentAnnouncementController } from './parent-announcement.controller';
import { ParentPasswordController } from './parent-password.controller';
import { ParentScheduleController } from './parent-schedule.controller';
import { ParentService } from './parent.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [
    ParentAuthController,
    ParentProfileController,
    ParentPasswordController,
    ParentAnnouncementController,
    ParentScheduleController,
  ],
  providers: [ParentService],
})
export class ParentModule {}

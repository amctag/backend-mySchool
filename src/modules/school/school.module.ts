import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { SchoolRefreshCookieService } from '../../auth/cookies/school-refresh-cookie.service';
import { SchoolAuthController } from './school-auth.controller';
import { SchoolAuthService } from './school-auth.service';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SchoolController, SchoolAuthController],
  providers: [SchoolService, SchoolAuthService, SchoolRefreshCookieService],
  exports: [SchoolService],
})
export class SchoolModule {}

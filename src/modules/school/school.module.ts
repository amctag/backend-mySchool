import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma/prisma.module';
import { SchoolController } from './school.controller';
import { SchoolService } from './school.service';

@Module({
  imports: [PrismaModule],
  controllers: [SchoolController],
  providers: [SchoolService],
})
export class SchoolModule {}

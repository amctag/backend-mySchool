import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  DashboardSchoolSettingsDto,
  UpdateDashboardSchoolSettingsDto,
} from './dto/dashboard-school-settings.dto';

@Injectable()
export class DashboardSchoolSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(
    user: AuthenticatedSchool,
  ): Promise<DashboardSchoolSettingsDto> {
    const school = await this.prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { id: true, teachersSeeAllClassCourses: true },
    });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return this.toDto(school);
  }

  async updateSettings(
    user: AuthenticatedSchool,
    dto: UpdateDashboardSchoolSettingsDto,
  ): Promise<DashboardSchoolSettingsDto> {
    const school = await this.prisma.school.update({
      where: { id: user.schoolId },
      data: {
        teachersSeeAllClassCourses: dto.teachersSeeAllClassCourses,
      },
      select: { id: true, teachersSeeAllClassCourses: true },
    });
    return this.toDto(school);
  }

  private toDto(school: {
    id: number;
    teachersSeeAllClassCourses: boolean;
  }): DashboardSchoolSettingsDto {
    return {
      schoolId: school.id,
      teachersSeeAllClassCourses: school.teachersSeeAllClassCourses,
    };
  }
}

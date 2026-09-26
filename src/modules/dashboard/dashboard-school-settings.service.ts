import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { normalizeAttendanceMode } from '../school/school-attendance-policy.service';
import {
  AttendanceModeSetting,
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
      select: {
        id: true,
        teachersSeeAllClassCourses: true,
        attendanceMode: true,
        teachersCanPublishAgenda: true,
        teachersCanPublishGrades: true,
      },
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
    const attendanceMode = dto.attendanceMode
      ? normalizeAttendanceMode(dto.attendanceMode)
      : undefined;
    const school = await this.prisma.school.update({
      where: { id: user.schoolId },
      data: {
        ...(dto.teachersSeeAllClassCourses !== undefined
          ? { teachersSeeAllClassCourses: dto.teachersSeeAllClassCourses }
          : {}),
        ...(attendanceMode !== undefined
          ? {
              attendanceMode,
              // Keep legacy flag in sync for any remaining readers.
              attendancePerCourse: attendanceMode === 'teacher_course',
            }
          : {}),
        ...(dto.teachersCanPublishAgenda !== undefined
          ? { teachersCanPublishAgenda: dto.teachersCanPublishAgenda }
          : {}),
        ...(dto.teachersCanPublishGrades !== undefined
          ? { teachersCanPublishGrades: dto.teachersCanPublishGrades }
          : {}),
      },
      select: {
        id: true,
        teachersSeeAllClassCourses: true,
        attendanceMode: true,
        teachersCanPublishAgenda: true,
        teachersCanPublishGrades: true,
      },
    });
    return this.toDto(school);
  }

  private toDto(school: {
    id: number;
    teachersSeeAllClassCourses: boolean;
    attendanceMode: string;
    teachersCanPublishAgenda: boolean;
    teachersCanPublishGrades: boolean;
  }): DashboardSchoolSettingsDto {
    return {
      schoolId: school.id,
      teachersSeeAllClassCourses: school.teachersSeeAllClassCourses,
      attendanceMode: normalizeAttendanceMode(
        school.attendanceMode,
      ) as AttendanceModeSetting,
      teachersCanPublishAgenda: school.teachersCanPublishAgenda,
      teachersCanPublishGrades: school.teachersCanPublishGrades,
    };
  }
}

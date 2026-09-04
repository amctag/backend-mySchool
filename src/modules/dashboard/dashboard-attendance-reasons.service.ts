import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardAttendanceReasonDto } from './dto/create-dashboard-attendance-reason.dto';
import { DashboardAttendanceReasonItemDto } from './dto/dashboard-attendance-reason-item.dto';
import { UpdateDashboardAttendanceReasonDto } from './dto/update-dashboard-attendance-reason.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

@Injectable()
export class DashboardAttendanceReasonsService {
  constructor(private readonly prisma: PrismaService) {}

  async listReasons(
    _user: AuthenticatedSchool,
    activeOnly = false,
  ): Promise<DashboardAttendanceReasonItemDto[]> {
    const rows = await this.prisma.attendanceReason.findMany({
      where: {
        deletedAt: null,
        ...(activeOnly ? { status: true } : {}),
      },
      include: {
        _count: {
          select: {
            attendanceDetails: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => this.toItem(row));
  }

  async getReason(
    _user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAttendanceReasonItemDto> {
    const row = await this.findReason(id);
    return this.toItem(row);
  }

  async createReason(
    _user: AuthenticatedSchool,
    dto: CreateDashboardAttendanceReasonDto,
  ): Promise<DashboardAttendanceReasonItemDto> {
    await this.assertCreatorPersonExists();
    const title = dto.title.trim();
    await this.assertTitleAvailable(title);

    const created = await this.prisma.attendanceReason.create({
      data: {
        title,
        status: dto.status ?? true,
        personId: DASHBOARD_CREATOR_PERSON_ID,
      },
      include: {
        _count: {
          select: {
            attendanceDetails: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return this.toItem(created);
  }

  async updateReason(
    _user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardAttendanceReasonDto,
  ): Promise<DashboardAttendanceReasonItemDto> {
    await this.findReason(id);

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      await this.assertTitleAvailable(title, id);
    }

    const updated = await this.prisma.attendanceReason.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        _count: {
          select: {
            attendanceDetails: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return this.toItem(updated);
  }

  async deleteReason(_user: AuthenticatedSchool, id: number): Promise<void> {
    const row = await this.findReason(id);
    if (row._count.attendanceDetails > 0) {
      throw new ConflictException(
        'This reason is used by attendance records and cannot be deleted',
      );
    }

    await this.prisma.attendanceReason.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: false,
      },
    });
  }

  private async findReason(id: number) {
    const row = await this.prisma.attendanceReason.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            attendanceDetails: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Attendance reason not found');
    }
    return row;
  }

  private async assertTitleAvailable(title: string, excludeId?: number) {
    const existing = await this.prisma.attendanceReason.findFirst({
      where: {
        deletedAt: null,
        title: { equals: title, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An attendance reason with this title already exists');
    }
  }

  private toItem(row: {
    id: number;
    title: string;
    status: boolean;
    _count: { attendanceDetails: number };
  }): DashboardAttendanceReasonItemDto {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      usageCount: row._count.attendanceDetails,
    };
  }

  private async assertCreatorPersonExists(): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: DASHBOARD_CREATOR_PERSON_ID },
      select: { id: true },
    });
    if (!person) {
      throw new BadRequestException('Creator person not found');
    }
  }
}

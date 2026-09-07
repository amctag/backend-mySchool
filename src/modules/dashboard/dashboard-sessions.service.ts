import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardSessionDto } from './dto/create-dashboard-session.dto';
import { DashboardSessionItemDto } from './dto/dashboard-session-item.dto';
import { UpdateDashboardSessionDto } from './dto/update-dashboard-session.dto';

@Injectable()
export class DashboardSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSessions(
    user: AuthenticatedSchool,
  ): Promise<DashboardSessionItemDto[]> {
    const rows = await this.prisma.session.findMany({
      where: { schoolId: user.schoolId },
      include: {
        _count: { select: { weeklyScheduleDetails: true } },
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.toItem(row));
  }

  async getSession(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardSessionItemDto> {
    const row = await this.findSession(user.schoolId, id);
    return this.toItem(row);
  }

  async createSession(
    user: AuthenticatedSchool,
    dto: CreateDashboardSessionDto,
  ): Promise<DashboardSessionItemDto> {
    const maxPosition = await this.prisma.session.aggregate({
      where: { schoolId: user.schoolId },
      _max: { position: true },
    });

    const created = await this.prisma.session.create({
      data: {
        schoolId: user.schoolId,
        sessionName: dto.sessionName.trim(),
        position: dto.position ?? (maxPosition._max.position ?? 0) + 1,
        status: dto.status ?? true,
      },
      include: {
        _count: { select: { weeklyScheduleDetails: true } },
      },
    });

    return this.toItem(created);
  }

  async updateSession(
    user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardSessionDto,
  ): Promise<DashboardSessionItemDto> {
    await this.findSession(user.schoolId, id);

    const updated = await this.prisma.session.update({
      where: { id },
      data: {
        ...(dto.sessionName !== undefined
          ? { sessionName: dto.sessionName.trim() }
          : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        _count: { select: { weeklyScheduleDetails: true } },
      },
    });

    return this.toItem(updated);
  }

  async deleteSession(user: AuthenticatedSchool, id: number): Promise<void> {
    const row = await this.findSession(user.schoolId, id);
    if (row._count.weeklyScheduleDetails > 0) {
      throw new ConflictException(
        'This session is used by weekly schedules and cannot be deleted',
      );
    }
    await this.prisma.session.delete({ where: { id } });
  }

  private async findSession(schoolId: number, id: number) {
    const row = await this.prisma.session.findFirst({
      where: { id, schoolId },
      include: {
        _count: { select: { weeklyScheduleDetails: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Session not found');
    }
    return row;
  }

  private toItem(row: {
    id: number;
    sessionName: string;
    position: number;
    status: boolean;
    _count: { weeklyScheduleDetails: number };
  }): DashboardSessionItemDto {
    return {
      id: row.id,
      sessionName: row.sessionName,
      position: row.position,
      status: row.status,
      usageCount: row._count.weeklyScheduleDetails,
    };
  }
}

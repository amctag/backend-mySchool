import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardNoticeTypeDto } from './dto/create-dashboard-notice-type.dto';
import { DashboardNoticeTypeItemDto } from './dto/dashboard-notices-response.dto';
import { UpdateDashboardNoticeTypeDto } from './dto/update-dashboard-notice-type.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

@Injectable()
export class DashboardNoticeTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTypes(
    _user: AuthenticatedSchool,
  ): Promise<DashboardNoticeTypeItemDto[]> {
    const rows = await this.prisma.noticeType.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            notices: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    });

    return rows.map((row) => this.toItem(row));
  }

  async getType(
    _user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardNoticeTypeItemDto> {
    const row = await this.findType(id);
    return this.toItem(row);
  }

  async createType(
    _user: AuthenticatedSchool,
    dto: CreateDashboardNoticeTypeDto,
  ): Promise<DashboardNoticeTypeItemDto> {
    await this.assertCreatorPersonExists();
    const title = dto.title.trim();
    await this.assertTitleAvailable(title);

    const created = await this.prisma.noticeType.create({
      data: {
        title,
        personId: DASHBOARD_CREATOR_PERSON_ID,
      },
      include: {
        _count: {
          select: {
            notices: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return this.toItem(created);
  }

  async updateType(
    _user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardNoticeTypeDto,
  ): Promise<DashboardNoticeTypeItemDto> {
    await this.findType(id);

    if (dto.title !== undefined) {
      await this.assertTitleAvailable(dto.title.trim(), id);
    }

    const updated = await this.prisma.noticeType.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      },
      include: {
        _count: {
          select: {
            notices: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });

    return this.toItem(updated);
  }

  async deleteType(_user: AuthenticatedSchool, id: number): Promise<void> {
    const row = await this.findType(id);
    if (row._count.notices > 0) {
      throw new ConflictException(
        'This notice type is used by notices and cannot be deleted',
      );
    }

    await this.prisma.noticeType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async findType(id: number) {
    const row = await this.prisma.noticeType.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            notices: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Notice type not found');
    }
    return row;
  }

  private async assertTitleAvailable(title: string, excludeId?: number) {
    const existing = await this.prisma.noticeType.findFirst({
      where: {
        deletedAt: null,
        title: { equals: title, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A notice type with this title already exists');
    }
  }

  private toItem(row: {
    id: number;
    title: string;
    _count: { notices: number };
  }): DashboardNoticeTypeItemDto {
    return {
      id: row.id,
      title: row.title,
      usageCount: row._count.notices,
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

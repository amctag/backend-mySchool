import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  TeacherAlbumItemDto,
  TeacherAlbumsQueryDto,
  TeacherAlbumsResponseDto,
} from './dto/teacher-media.dto';
import { formatDateOnly } from './teacher.util';

const albumInclude = {
  year: { select: { title: true } },
  images: {
    where: { deletedAt: null },
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
};

type AlbumRecord = Prisma.AlbumGetPayload<{ include: typeof albumInclude }>;

@Injectable()
export class TeacherAlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listAlbums(
    user: AuthenticatedTeacher,
    query: TeacherAlbumsQueryDto,
  ): Promise<TeacherAlbumsResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });
    const yearIds = await this.taughtYearIds(user);
    if (yearIds.length === 0) {
      return { items: [], pagination: buildPaginationMeta(page, limit, 0) };
    }
    const where = {
      deletedAt: null,
      status: 1,
      schoolId: user.schoolId,
      yearId: { in: yearIds },
    } as const;
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.album.count({ where }),
      this.prisma.album.findMany({
        where,
        include: albumInclude,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row)),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getAlbum(
    user: AuthenticatedTeacher,
    albumId: number,
  ): Promise<TeacherAlbumItemDto> {
    this.teacherAccess.ensureTeacherRole(user);
    const where = await this.buildWhere(user);
    const row = await this.prisma.album.findFirst({
      where: { ...where, id: albumId },
      include: albumInclude,
    });
    if (!row) {
      throw new NotFoundException('Album not found');
    }
    return this.toItem(row);
  }

  private async buildWhere(
    user: AuthenticatedTeacher,
  ): Promise<Prisma.AlbumWhereInput> {
    const yearIds = await this.taughtYearIds(user);
    return {
      deletedAt: null,
      status: 1,
      schoolId: user.schoolId,
      ...(yearIds.length > 0 ? { yearId: { in: yearIds } } : { id: -1 }),
    };
  }

  private async taughtYearIds(user: AuthenticatedTeacher): Promise<number[]> {
    const rows = await this.prisma.teach.findMany({
      where: {
        teacherId: user.teacherId,
        section: { schoolId: user.schoolId },
      },
      select: { yearId: true },
    });
    return [...new Set(rows.map((row) => row.yearId))];
  }

  private toItem(row: AlbumRecord): TeacherAlbumItemDto {
    const images = row.images.map((image) => ({
      id: image.id,
      imageLink: image.imageLink,
      caption: image.caption,
      position: image.position,
    }));
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      date: formatDateOnly(row.date),
      yearTitle: row.year.title,
      photoCount: images.length,
      coverImage: images[0]?.imageLink ?? null,
      images,
    };
  }
}

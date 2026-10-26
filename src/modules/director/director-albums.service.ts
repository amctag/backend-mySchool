import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  TeacherAlbumsQueryDto,
  TeacherAlbumItemDto,
  TeacherAlbumsResponseDto,
} from './dto/director-albums.dto';

@Injectable()
export class DirectorAlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listAlbums(
    user: AuthenticatedDirector,
    query: TeacherAlbumsQueryDto,
  ): Promise<TeacherAlbumsResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });

    const where = {
      deletedAt: null,
      status: 1,
      schoolId: user.schoolId,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.album.count({ where }),
      this.prisma.album.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        date: row.date?.toISOString().split('T')[0],
        title: row.title,
        images: [],
        yearTitle: '',
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getAlbum(
    user: AuthenticatedDirector,
    albumId: number,
  ): Promise<TeacherAlbumItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const album = await this.prisma.album.findFirst({
      where: {
        id: albumId,
        schoolId: user.schoolId,
      },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    return {
      id: album.id,
      date: album.date?.toISOString().split('T')[0],
      title: album.title,
      images: [],
      yearTitle: '',
    };
  }

  async createAlbum(
    user: AuthenticatedDirector,
    dto: any,
  ): Promise<TeacherAlbumItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const album = await this.prisma.album.create({
      data: {
        title: dto.title,
        description: '',
        yearId: dto.yearId,
        date: dto.date,
        schoolId: user.schoolId,
      },
    });

    return {
      id: album.id,
      date: album.date?.toISOString().split('T')[0],
      title: album.title,
      images: [],
      yearTitle: '',
    };
  }

  async updateAlbum(
    user: AuthenticatedDirector,
    albumId: number,
    dto: any,
  ): Promise<TeacherAlbumItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const album = await this.prisma.album.findFirst({
      where: {
        id: albumId,
        schoolId: user.schoolId,
      },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    const updated = await this.prisma.album.update({
      where: { id: albumId },
      data: {
        title: dto.title,
        date: dto.date,
      },
    });

    return {
      id: updated.id,
      date: updated.date?.toISOString().split('T')[0],
      title: updated.title,
      images: [],
      yearTitle: '',
    };
  }

  async deleteAlbum(
    user: AuthenticatedDirector,
    albumId: number,
  ): Promise<boolean> {
    this.directorAccess.ensureDirectorRole(user.role);

    const album = await this.prisma.album.findFirst({
      where: {
        id: albumId,
        schoolId: user.schoolId,
      },
    });

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    await this.prisma.album.delete({
      where: { id: albumId },
    });

    return true;
  }
}
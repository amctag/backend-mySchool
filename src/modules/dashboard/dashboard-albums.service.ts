import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ParentFcmNotifyService } from '../../fcm/parent-fcm-notify.service';
import { CreateDashboardAlbumDto } from './dto/create-dashboard-album.dto';
import { DashboardAlbumsQueryDto } from './dto/dashboard-albums-query.dto';
import {
  DashboardAlbumItemDto,
  DashboardAlbumsResponseDto,
} from './dto/dashboard-albums-response.dto';

const albumInclude = {
  year: { select: { id: true, title: true } },
  images: {
    where: { deletedAt: null },
    orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }],
  },
};

type AlbumRecord = Prisma.AlbumGetPayload<{ include: typeof albumInclude }>;

@Injectable()
export class DashboardAlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
  ) {}

  async listAlbums(
    user: AuthenticatedSchool,
    query: DashboardAlbumsQueryDto,
  ): Promise<DashboardAlbumsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const search = query.search?.trim();
    const where: Prisma.AlbumWhereInput = {
      deletedAt: null,
      schoolId: user.schoolId,
      ...(query.yearId ? { yearId: query.yearId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.album.count({ where }),
      this.prisma.album.findMany({
        where,
        include: albumInclude,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toItem(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getAlbum(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAlbumItemDto> {
    const album = await this.findAlbum(user.schoolId, id);
    return this.toItem(album);
  }

  async createAlbum(
    user: AuthenticatedSchool,
    dto: CreateDashboardAlbumDto,
  ): Promise<DashboardAlbumItemDto> {
    const year = await this.assertYear(user.schoolId, dto.yearId);
    const imageLinks = this.normalizeImageLinks(dto.imageLinks);

    const album = await this.prisma.album.create({
      data: {
        schoolId: user.schoolId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        date: this.parseDate(dto.date),
        status: 1,
        yearId: year.id,
        images: {
          create: imageLinks.map((imageLink, index) => ({
            imageLink,
            position: index + 1,
          })),
        },
      },
      include: albumInclude,
    });

    await this.notifyAudience(
      user.schoolId,
      year.id,
      album.id,
      album.title,
      album.description,
    );

    return this.toItem(album);
  }

  async updateAlbum(
    user: AuthenticatedSchool,
    id: number,
    dto: CreateDashboardAlbumDto,
  ): Promise<DashboardAlbumItemDto> {
    await this.findAlbum(user.schoolId, id);
    const year = await this.assertYear(user.schoolId, dto.yearId);
    const imageLinks = this.normalizeImageLinks(dto.imageLinks);

    const album = await this.prisma.$transaction(async (tx) => {
      await tx.albumImage.updateMany({
        where: { albumId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (imageLinks.length > 0) {
        await tx.albumImage.createMany({
          data: imageLinks.map((imageLink, index) => ({
            albumId: id,
            imageLink,
            position: index + 1,
          })),
        });
      }
      return tx.album.update({
        where: { id },
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          date: this.parseDate(dto.date),
          yearId: year.id,
          status: 1,
        },
        include: albumInclude,
      });
    });

    await this.notifyAudience(
      user.schoolId,
      year.id,
      album.id,
      album.title,
      album.description,
    );

    return this.toItem(album);
  }

  async deleteAlbum(user: AuthenticatedSchool, id: number): Promise<void> {
    await this.findAlbum(user.schoolId, id);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.albumImage.updateMany({
        where: { albumId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.album.update({
        where: { id },
        data: { deletedAt: now, status: 0 },
      }),
    ]);
  }

  private async findAlbum(schoolId: number, id: number): Promise<AlbumRecord> {
    const album = await this.prisma.album.findFirst({
      where: { id, schoolId, deletedAt: null },
      include: albumInclude,
    });
    if (!album) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  private async assertYear(schoolId: number, yearId: number) {
    const year = await this.prisma.year.findFirst({
      where: { id: yearId, schoolId },
      select: { id: true, title: true },
    });
    if (!year) {
      throw new NotFoundException('Year not found');
    }
    return year;
  }

  private normalizeImageLinks(links?: string[]): string[] {
    return [...new Set((links ?? []).map((link) => link.trim()).filter(Boolean))];
  }

  private toItem(album: AlbumRecord): DashboardAlbumItemDto {
    const images = album.images.map((image) => ({
      id: image.id,
      imageLink: image.imageLink,
      caption: image.caption,
      position: image.position,
    }));
    return {
      id: album.id,
      title: album.title,
      description: album.description,
      date: album.date.toISOString().slice(0, 10),
      yearId: album.year.id,
      yearTitle: album.year.title,
      photoCount: images.length,
      coverImage: images[0]?.imageLink ?? null,
      images,
      createdAt: album.createdAt.toISOString(),
    };
  }

  private async notifyAudience(
    schoolId: number,
    yearId: number,
    albumId: number,
    title: string,
    description: string,
  ): Promise<void> {
    const pushTitle = title.trim() || 'Album';
    const data = {
      type: 'album',
      albumId: String(albumId),
      route: 'albums',
    };

    const parents = await this.prisma.parent.findMany({
      where: {
        students: {
          some: {
            registrations: {
              some: {
                status: true,
                schoolId,
                section: { yearId },
              },
            },
          },
        },
      },
      select: { personId: true },
    });
    await this.parentFcmNotify.sendToPersonIds(
      parents.map((parent) => parent.personId),
      pushTitle,
      description,
      data,
    );

    const teachers = await this.prisma.teacher.findMany({
      where: {
        person: { status: true },
        schools: { some: { schoolId, isActive: true } },
        teaches: { some: { yearId } },
      },
      select: { personId: true },
    });
    await this.parentFcmNotify.sendToPersonIds(
      teachers.map((teacher) => teacher.personId),
      pushTitle,
      description,
      data,
    );
  }

  private parseDate(value?: string): Date {
    if (!value) {
      const today = new Date();
      return new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
    }
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}

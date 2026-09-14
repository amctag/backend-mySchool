import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ParentFcmNotifyService } from '../../fcm/parent-fcm-notify.service';
import { CreateDashboardAlbumDto } from './dto/create-dashboard-album.dto';

@Injectable()
export class DashboardAlbumsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
  ) {}

  async createAlbum(user: AuthenticatedSchool, dto: CreateDashboardAlbumDto) {
    const year = await this.prisma.year.findFirst({
      where: { id: dto.yearId, schoolId: user.schoolId },
      select: { id: true, title: true },
    });
    if (!year) {
      throw new NotFoundException('Year not found');
    }

    const imageLinks = (dto.imageLinks ?? [])
      .map((link) => link.trim())
      .filter((link) => link.length > 0);

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
      include: {
        year: { select: { title: true } },
        images: {
          where: { deletedAt: null },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
        },
      },
    });

    await this.notifyAudience(
      user.schoolId,
      year.id,
      album.id,
      album.title,
      album.description,
    );

    return {
      id: album.id,
      title: album.title,
      description: album.description,
      date: album.date.toISOString().slice(0, 10),
      yearId: year.id,
      yearTitle: year.title,
      photoCount: album.images.length,
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

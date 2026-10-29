import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  DirectorNoticesQueryDto,
  DirectorNoticeItemDto,
  DirectorNoticesResponseDto,
} from './dto/director-notices.dto';
import { ParentFcmNotifyService } from '../../fcm/parent-fcm-notify.service';

@Injectable()
export class DirectorNoticesService {
  private readonly logger = new Logger(DirectorNoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
  ) {}

  async listNotices(
    user: AuthenticatedDirector,
    query: DirectorNoticesQueryDto,
  ): Promise<DirectorNoticesResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });

    const where: any = {
      schoolId: user.schoolId,
      ...(query.date ? { date: query.date } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        include: {
          sections: {
            where: { deletedAt: null },
            include: {
              section: { include: { class: true, sectionTitle: true } },
            },
          },
          students: {
            where: { deletedAt: null },
            include: { student: { include: { person: true } } },
          },
        },
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
        content: row.description,
        createdAt: row.createdAt?.toISOString().split('T')[0] || '',
        ...this.noticeRelations(row),
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getNotice(
    user: AuthenticatedDirector,
    noticeId: number,
  ): Promise<DirectorNoticeItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        schoolId: user.schoolId,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          include: {
            section: { include: { class: true, sectionTitle: true } },
          },
        },
        students: {
          where: { deletedAt: null },
          include: { student: { include: { person: true } } },
        },
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    return {
      id: notice.id,
      date: notice.date?.toISOString().split('T')[0],
      title: notice.title,
      content: notice.description,
      createdAt: notice.createdAt?.toISOString().split('T')[0] || '',
      ...this.noticeRelations(notice),
    };
  }

  async createNotice(
    user: AuthenticatedDirector,
    dto: any,
  ): Promise<DirectorNoticeItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);
    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, schoolId: user.schoolId },
      select: { id: true, yearId: true },
    });
    if (!section) throw new NotFoundException('Section not found');
    const studentIds: number[] = Array.isArray(dto.studentIds)
      ? dto.studentIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    if (dto.targetType === 'student' && studentIds.length === 0) {
      throw new ForbiddenException('At least one student is required');
    }
    if (studentIds.length) {
      const count = await this.prisma.registration.count({
        where: {
          schoolId: user.schoolId,
          sectionId: section.id,
          studentId: { in: studentIds },
          status: true,
        },
      });
      if (count !== new Set(studentIds).size) {
        throw new ForbiddenException('Student is not in this section');
      }
    }
    const notice = await this.prisma.notice.create({
      data: {
        title: dto.title ?? '',
        description: dto.description,
        date: new Date(dto.publishDate),
        personId: user.personId,
        schoolId: user.schoolId,
        sections: { create: { sectionId: section.id } },
        ...(studentIds.length
          ? {
              students: {
                createMany: {
                  data: studentIds.map((studentId) => ({ studentId })),
                },
              },
            }
          : {}),
      },
    });

    if (studentIds.length > 0) {
      try {
        const students = await this.prisma.student.findMany({
          where: { id: { in: [...new Set(studentIds)] }, parentId: { not: null } },
          select: { parent: { select: { personId: true } } },
        });
        const personIds = [...new Set(students.map((student) => student.parent?.personId).filter((id): id is number => id != null))];
        await this.parentFcmNotify.sendToPersonIds(personIds, notice.title.trim() || 'Notice', notice.description, {
          type: 'notice', noticeId: String(notice.id),
        });
      } catch (error) {
        this.logger.error(`notice notification failed notice=${notice.id} school=${user.schoolId}: ${(error as Error)?.message}`, (error as Error)?.stack);
      }
    }

    return {
      id: notice.id,
      date: notice.date?.toISOString().split('T')[0],
      title: notice.title,
      content: notice.description,
      createdAt: notice.createdAt?.toISOString().split('T')[0] || '',
      createdBy: '',
    };
  }

  async updateNotice(
    user: AuthenticatedDirector,
    noticeId: number,
    dto: any,
  ): Promise<DirectorNoticeItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        schoolId: user.schoolId,
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    const section = await this.prisma.section.findFirst({
      where: { id: dto.sectionId, schoolId: user.schoolId },
      select: { id: true },
    });
    if (!section) throw new NotFoundException('Section not found');
    const ids = dto.studentIds ?? [];
    if (dto.targetType === 'student' && ids.length === 0)
      throw new ForbiddenException('At least one student is required');
    const count = ids.length
      ? await this.prisma.registration.count({
          where: {
            schoolId: user.schoolId,
            sectionId: section.id,
            studentId: { in: ids },
            status: true,
          },
        })
      : 0;
    if (count !== new Set(ids).size)
      throw new ForbiddenException('Student is not in this section');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.noticeSection.deleteMany({ where: { noticeId } });
      await tx.noticeStudent.deleteMany({ where: { noticeId } });
      return tx.notice.update({
        where: { id: noticeId },
        data: {
          title: dto.title ?? '',
          description: dto.description,
          date: new Date(dto.publishDate),
          sections: { create: { sectionId: section.id } },
          ...(ids.length
            ? {
                students: {
                  createMany: {
                    data: ids.map((studentId: number) => ({ studentId })),
                  },
                },
              }
            : {}),
        },
        include: {
          sections: {
            include: {
              section: { include: { class: true, sectionTitle: true } },
            },
          },
          students: { include: { student: { include: { person: true } } } },
        },
      });
    });

    return {
      id: updated.id,
      date: updated.date?.toISOString().split('T')[0],
      title: updated.title,
      content: updated.description,
      createdAt: updated.createdAt?.toISOString().split('T')[0] || '',
      ...this.noticeRelations(updated),
    };
  }

  private noticeRelations(row: any) {
    const section = row.sections?.[0]?.section;
    const students = (row.students ?? [])
      .map((item: any) =>
        item.student?.person
          ? [
              item.student.person.firstName,
              item.student.person.middleName,
              item.student.person.lastName,
            ]
              .filter(Boolean)
              .join(' ')
          : '',
      )
      .filter(Boolean);
    return {
      classId: section?.id ?? 0,
      sectionId: section?.id ?? 0,
      classLabel: section
        ? `${section.class.className} - ${section.sectionTitle.title}`
        : '',
      targetType: students.length ? 'student' : 'section',
      targetId: students.length
        ? row.students[0].studentId
        : (section?.id ?? 0),
      targetIds: row.students?.map((item: any) => item.studentId) ?? [],
      targetLabel: students.length ? students.join(', ') : 'Section',
      createdBy: '',
    };
  }

  async deleteNotice(
    user: AuthenticatedDirector,
    noticeId: number,
  ): Promise<boolean> {
    this.directorAccess.ensureDirectorRole(user.role);

    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        schoolId: user.schoolId,
      },
    });

    if (!notice) {
      throw new NotFoundException('Notice not found');
    }

    await this.prisma.notice.delete({
      where: { id: noticeId },
    });

    return true;
  }
}

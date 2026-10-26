import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { DirectorAccessService } from './director-access.service';
import {
  buildPaginationMeta,
  resolvePagination,
} from '../../common/dto/pagination-query.dto';
import {
  TeacherTasksQueryDto,
  TeacherTaskItemDto,
  TeacherTasksResponseDto,
} from './dto/director-tasks.dto';

@Injectable()
export class DirectorTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly directorAccess: DirectorAccessService,
  ) {}

  async listTasks(
    user: AuthenticatedDirector,
    query: TeacherTasksQueryDto,
  ): Promise<TeacherTasksResponseDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const { page, limit, skip } = resolvePagination({
      page: query.page,
      limit: query.limit ?? 20,
    });

    const where: any = {
      schoolId: user.schoolId,
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.teacherTask.count({ where }),
      this.prisma.teacherTask.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        dueDate: '',
        courseTitle: '',
        gradeLevel: '',
        createdBy: '',
        createdAt: row.createdAt?.toISOString().split('T')[0] || '',
      })),
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  async getTask(
    user: AuthenticatedDirector,
    taskId: number,
  ): Promise<TeacherTaskItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const task = await this.prisma.teacherTask.findFirst({
      where: {
        id: taskId,
        schoolId: user.schoolId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return {
      id: task.id,
      title: task.title,
      dueDate: '',
      courseTitle: '',
      gradeLevel: '',
      createdBy: '',
      createdAt: task.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async createTask(
    user: AuthenticatedDirector,
    dto: any,
  ): Promise<TeacherTaskItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const task = await this.prisma.teacherTask.create({
      data: {
        title: dto.title,
        description: '',
        schoolId: user.schoolId,
      },
    });

    return {
      id: task.id,
      title: task.title,
      dueDate: '',
      courseTitle: '',
      gradeLevel: '',
      createdBy: '',
      createdAt: task.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async updateTask(
    user: AuthenticatedDirector,
    taskId: number,
    dto: any,
  ): Promise<TeacherTaskItemDto> {
    this.directorAccess.ensureDirectorRole(user.role);

    const task = await this.prisma.teacherTask.findFirst({
      where: {
        id: taskId,
        schoolId: user.schoolId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const updated = await this.prisma.teacherTask.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: '',
        schoolId: user.schoolId,
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      dueDate: '',
      courseTitle: '',
      gradeLevel: '',
      createdBy: '',
      createdAt: updated.createdAt?.toISOString().split('T')[0] || '',
    };
  }

  async deleteTask(
    user: AuthenticatedDirector,
    taskId: number,
  ): Promise<boolean> {
    this.directorAccess.ensureDirectorRole(user.role);

    const task = await this.prisma.teacherTask.findFirst({
      where: {
        id: taskId,
        schoolId: user.schoolId,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.teacherTask.delete({
      where: { id: taskId },
    });

    return true;
  }
}
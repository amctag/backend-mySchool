import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ParentFcmNotifyService } from '../../fcm/parent-fcm-notify.service';
import {
  CreateDashboardTeacherTaskDto,
  DashboardTeacherTaskItemDto,
  DashboardTeacherTasksQueryDto,
  DashboardTeacherTasksResponseDto,
} from './dto/dashboard-teacher-tasks.dto';

@Injectable()
export class DashboardTeacherTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
  ) {}

  async listTasks(
    user: AuthenticatedSchool,
    query: DashboardTeacherTasksQueryDto,
  ): Promise<DashboardTeacherTasksResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(user.schoolId, query.search);
    const teacherCount = await this.countActiveTeachers(user.schoolId);

    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.teacherTask.count({ where }),
      this.prisma.teacherTask.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { completions: true } },
        },
      }),
    ]);

    return {
      items: tasks.map((task) =>
        this.toItem(task, teacherCount, task._count.completions),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getTask(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardTeacherTaskItemDto> {
    const task = await this.prisma.teacherTask.findFirst({
      where: { id, schoolId: user.schoolId, deletedAt: null },
      include: { _count: { select: { completions: true } } },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const teacherCount = await this.countActiveTeachers(user.schoolId);
    return this.toItem(task, teacherCount, task._count.completions);
  }

  async createTask(
    user: AuthenticatedSchool,
    dto: CreateDashboardTeacherTaskDto,
  ): Promise<DashboardTeacherTaskItemDto> {
    const task = await this.prisma.teacherTask.create({
      data: {
        schoolId: user.schoolId,
        title: dto.title,
        description: dto.description,
      },
    });

    await this.notifyTeachers(
      user.schoolId,
      task.id,
      task.title,
      task.description,
    );

    const teacherCount = await this.countActiveTeachers(user.schoolId);
    return this.toItem(task, teacherCount, 0);
  }

  private async notifyTeachers(
    schoolId: number,
    taskId: number,
    title: string,
    description: string,
  ): Promise<void> {
    const teachers = await this.prisma.teacher.findMany({
      where: {
        person: { status: true },
        schools: {
          some: {
            schoolId,
            isActive: true,
          },
        },
      },
      select: { personId: true },
    });

    await this.parentFcmNotify.sendToPersonIds(
      teachers.map((teacher) => teacher.personId),
      title.trim() || 'New task',
      description,
      {
        type: 'task',
        taskId: String(taskId),
        route: 'tasks',
      },
    );
  }

  private async countActiveTeachers(schoolId: number): Promise<number> {
    return this.prisma.teacher.count({
      where: {
        person: { status: true },
        schools: {
          some: {
            schoolId,
            isActive: true,
          },
        },
      },
    });
  }

  private buildWhere(
    schoolId: number,
    search?: string,
  ): Prisma.TeacherTaskWhereInput {
    const where: Prisma.TeacherTaskWhereInput = {
      schoolId,
      deletedAt: null,
    };
    const term = search?.trim();
    if (term) {
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private toItem(
    task: {
      id: number;
      title: string;
      description: string;
      createdAt: Date;
    },
    teacherCount: number,
    completedCount: number,
  ): DashboardTeacherTaskItemDto {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      createdAt: task.createdAt.toISOString(),
      completedCount,
      teacherCount,
    };
  }
}

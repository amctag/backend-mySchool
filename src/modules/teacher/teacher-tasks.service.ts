import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { TeacherAccessService } from './teacher-access.service';
import {
  TeacherTaskItemDto,
  TeacherTasksResponseDto,
} from './dto/teacher-tasks.dto';

@Injectable()
export class TeacherTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teacherAccess: TeacherAccessService,
  ) {}

  async listTasks(
    user: AuthenticatedTeacher,
  ): Promise<TeacherTasksResponseDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const tasks = await this.prisma.teacherTask.findMany({
      where: {
        schoolId: user.schoolId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: {
        completions: {
          where: { teacherId: user.teacherId },
          take: 1,
        },
      },
    });

    return {
      tasks: tasks.map((task) => this.toItem(task)),
    };
  }

  async completeTask(
    user: AuthenticatedTeacher,
    taskId: number,
  ): Promise<TeacherTaskItemDto> {
    this.teacherAccess.ensureTeacherRole(user);

    const task = await this.prisma.teacherTask.findFirst({
      where: {
        id: taskId,
        schoolId: user.schoolId,
        deletedAt: null,
      },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const completion = await this.prisma.teacherTaskCompletion.upsert({
      where: {
        taskId_teacherId: {
          taskId,
          teacherId: user.teacherId,
        },
      },
      create: {
        taskId,
        teacherId: user.teacherId,
      },
      update: {},
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      createdAt: task.createdAt.toISOString(),
      isCompleted: true,
      completedAt: completion.completedAt.toISOString(),
    };
  }

  private toItem(task: {
    id: number;
    title: string;
    description: string;
    createdAt: Date;
    completions: { completedAt: Date }[];
  }): TeacherTaskItemDto {
    const completion = task.completions[0];
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      createdAt: task.createdAt.toISOString(),
      isCompleted: Boolean(completion),
      completedAt: completion?.completedAt.toISOString() ?? null,
    };
  }
}

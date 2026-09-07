import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ParentFcmNotifyService } from '../../fcm/parent-fcm-notify.service';
import { CreateDashboardActivityDto } from './dto/create-dashboard-activity.dto';
import { DashboardActivitiesQueryDto } from './dto/dashboard-activities-query.dto';
import {
  DashboardActivityItemDto,
  DashboardActivitiesResponseDto,
} from './dto/dashboard-activities-response.dto';

const DASHBOARD_CREATOR_PERSON_ID = 1;

const activityInclude = {
  person: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
  },
  year: {
    select: {
      id: true,
      title: true,
      schoolId: true,
    },
  },
} as const;

type ActivityRecord = {
  id: number;
  title: string;
  content: string;
  date: Date;
  image: string;
  personId: number;
  createdAt: Date;
  yearId: number | null;
  year: { id: number; title: string; schoolId: number } | null;
  person: {
    id: number;
    firstName: string;
    middleName: string;
    lastName: string;
  };
};

@Injectable()
export class DashboardActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parentFcmNotify: ParentFcmNotifyService,
  ) {}

  async listActivities(
    user: AuthenticatedSchool,
    query: DashboardActivitiesQueryDto,
  ): Promise<DashboardActivitiesResponseDto> {
    await this.assertCreatorPersonExists();

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = this.buildWhere(user.schoolId, query);

    const [total, activities] = await this.prisma.$transaction([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        include: activityInclude,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: activities.map((activity) => this.toItem(activity)),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getActivity(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardActivityItemDto> {
    await this.assertCreatorPersonExists();

    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [
          { year: { schoolId: user.schoolId } },
          { yearId: null, person: { schoolId: user.schoolId } },
          { yearId: null, personId: DASHBOARD_CREATOR_PERSON_ID },
        ],
      },
      include: activityInclude,
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    return this.toItem(activity);
  }

  async createActivity(
    user: AuthenticatedSchool,
    dto: CreateDashboardActivityDto,
  ): Promise<DashboardActivityItemDto> {
    await this.assertCreatorPersonExists();

    let yearId: number | undefined;
    if (dto.yearId) {
      const year = await this.prisma.year.findFirst({
        where: {
          id: dto.yearId,
          schoolId: user.schoolId,
        },
        select: { id: true },
      });

      if (!year) {
        throw new NotFoundException('Year not found');
      }

      yearId = year.id;
    }

    const activity = await this.prisma.activity.create({
      data: {
        title: dto.title.trim(),
        content: dto.content.trim(),
        date: this.parseDate(dto.date),
        image: dto.image?.trim() || '',
        personId: DASHBOARD_CREATOR_PERSON_ID,
        yearId: yearId ?? null,
      },
      include: activityInclude,
    });

    await this.notifyParents(
      user.schoolId,
      yearId,
      activity.id,
      activity.title,
      activity.content,
    );

    return this.toItem(activity);
  }

  private async notifyParents(
    schoolId: number,
    yearId: number | undefined,
    activityId: number,
    title: string,
    content: string,
  ): Promise<void> {
    const parents = await this.prisma.parent.findMany({
      where: {
        students: {
          some: {
            registrations: {
              some: {
                status: true,
                schoolId,
                ...(yearId ? { section: { yearId } } : {}),
              },
            },
          },
        },
      },
      select: { personId: true },
    });

    await this.parentFcmNotify.sendToPersonIds(
      parents.map((parent) => parent.personId),
      title.trim() || 'Activity',
      content,
      {
        type: 'activity',
        activityId: String(activityId),
      },
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

  private async assertCreatorPersonExists(): Promise<void> {
    const person = await this.prisma.person.findFirst({
      where: { id: DASHBOARD_CREATOR_PERSON_ID },
      select: { id: true },
    });

    if (!person) {
      throw new NotFoundException('Creator person not found');
    }
  }

  private buildWhere(
    schoolId: number,
    query: DashboardActivitiesQueryDto,
  ): Prisma.ActivityWhereInput {
    const search = query.search?.trim();
    const schoolScope: Prisma.ActivityWhereInput = {
      deletedAt: null,
      OR: [
        { year: { schoolId } },
        { yearId: null, person: { schoolId } },
        { yearId: null, personId: DASHBOARD_CREATOR_PERSON_ID },
      ],
    };

    const where: Prisma.ActivityWhereInput = { AND: [schoolScope] };

    if (search) {
      where.AND = [
        schoolScope,
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { content: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (query.yearId) {
      const yearFilter: Prisma.ActivityWhereInput = {
        OR: [{ yearId: query.yearId }, { yearId: null }],
      };
      where.AND = [...(where.AND as Prisma.ActivityWhereInput[]), yearFilter];
    }

    return where;
  }

  private toItem(activity: ActivityRecord): DashboardActivityItemDto {
    return {
      id: activity.id,
      title: activity.title,
      content: activity.content,
      date: activity.date.toISOString().slice(0, 10),
      image: activity.image,
      scope: activity.year ? activity.year.title : 'All school',
      yearId: activity.year?.id ?? null,
      yearTitle: activity.year?.title ?? null,
      createdAt: activity.createdAt.toISOString(),
      personId: activity.personId,
      createdByName: this.formatPersonName(activity.person),
    };
  }

  private formatPersonName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');
  }
}

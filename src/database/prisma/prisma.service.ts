import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  override get parentSession(): PrismaClient['parentSession'] {
    return super.parentSession;
  }

  override get passwordChangeOtp(): PrismaClient['passwordChangeOtp'] {
    return super.passwordChangeOtp;
  }

  override get passwordResetOtp(): PrismaClient['passwordResetOtp'] {
    return super.passwordResetOtp;
  }

  override get announcement(): PrismaClient['announcement'] {
    return super.announcement;
  }

  override get activity(): PrismaClient['activity'] {
    return super.activity;
  }

  override get schoolDetail(): PrismaClient['schoolDetail'] {
    return super.schoolDetail;
  }

  override get attendance(): PrismaClient['attendance'] {
    return super.attendance;
  }

  override get attendanceDetail(): PrismaClient['attendanceDetail'] {
    return super.attendanceDetail;
  }

  override get attendanceReason(): PrismaClient['attendanceReason'] {
    return super.attendanceReason;
  }

  override get notice(): PrismaClient['notice'] {
    return super.notice;
  }

  override get noticeStudent(): PrismaClient['noticeStudent'] {
    return super.noticeStudent;
  }

  override get noticeSection(): PrismaClient['noticeSection'] {
    return super.noticeSection;
  }

  override get noticeType(): PrismaClient['noticeType'] {
    return super.noticeType;
  }

  override get agenda(): PrismaClient['agenda'] {
    return super.agenda;
  }

  override get agendaSection(): PrismaClient['agendaSection'] {
    return super.agendaSection;
  }

  override get album(): PrismaClient['album'] {
    return super.album;
  }

  override get albumImage(): PrismaClient['albumImage'] {
    return super.albumImage;
  }

  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const connectionString =
      configService.get<string>('database.url') ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined');
    }

    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}

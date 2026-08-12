import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

export class SeedPrismaClient extends PrismaClient {
  override get announcement(): PrismaClient['announcement'] {
    return super.announcement;
  }

  override get announcementTarget(): PrismaClient['announcementTarget'] {
    return super.announcementTarget;
  }

  override get announcementSection(): PrismaClient['announcementSection'] {
    return super.announcementSection;
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

  constructor(connectionString: string) {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }
}

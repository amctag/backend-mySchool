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

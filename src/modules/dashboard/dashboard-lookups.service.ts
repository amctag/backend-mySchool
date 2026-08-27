import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateNamedLookupDto,
  CreateRegionDto,
} from './dto/create-lookup.dto';
import { LookupItemDto, RegionItemDto } from './dto/lookup-item.dto';

@Injectable()
export class DashboardLookupsService {
  constructor(private readonly prisma: PrismaService) {}

  listNationalities(): Promise<LookupItemDto[]> {
    return this.prisma.nationality.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    });
  }

  async createNationality(dto: CreateNamedLookupDto): Promise<LookupItemDto> {
    try {
      return await this.prisma.nationality.create({
        data: { name: dto.name },
        select: { id: true, name: true },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Nationality');
    }
  }

  listJobs(): Promise<LookupItemDto[]> {
    return this.prisma.parentJob.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async createJob(dto: CreateNamedLookupDto): Promise<LookupItemDto> {
    try {
      return await this.prisma.parentJob.create({
        data: { name: dto.name },
        select: { id: true, name: true },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Job');
    }
  }

  listGovernorates(): Promise<LookupItemDto[]> {
    return this.prisma.governorate.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  async createGovernorate(dto: CreateNamedLookupDto): Promise<LookupItemDto> {
    try {
      const maxCode = await this.prisma.governorate.aggregate({
        _max: { code: true },
      });

      return await this.prisma.governorate.create({
        data: {
          name: dto.name,
          code: (maxCode._max.code ?? 0) + 1,
        },
        select: { id: true, name: true },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Governorate');
    }
  }

  listRegions(governorateId?: number): Promise<RegionItemDto[]> {
    return this.prisma.region.findMany({
      where: governorateId ? { governorateId } : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        governorateId: true,
      },
    });
  }

  async createRegion(dto: CreateRegionDto): Promise<RegionItemDto> {
    const governorate = await this.prisma.governorate.findUnique({
      where: { id: dto.governorateId },
      select: { id: true },
    });

    if (!governorate) {
      throw new NotFoundException('Governorate not found');
    }

    try {
      return await this.prisma.region.create({
        data: {
          name: dto.name,
          governorateId: governorate.id,
        },
        select: {
          id: true,
          name: true,
          governorateId: true,
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'Region');
    }
  }

  private rethrowUnique(error: unknown, label: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(`${label} already exists`);
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(`Invalid ${label.toLowerCase()} reference`);
    }

    throw error;
  }
}

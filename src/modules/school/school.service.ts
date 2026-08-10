import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SchoolDetailsResponseDto } from './dto/school-details-response.dto';

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  async getSchoolDetails(schoolId: number): Promise<SchoolDetailsResponseDto> {
    const details = await this.findSchoolDetails(schoolId);

    if (!details) {
      throw new NotFoundException('School details not found');
    }

    return details;
  }

  async getSchoolDetailsForSchoolIds(
    schoolIds: number[],
  ): Promise<SchoolDetailsResponseDto[]> {
    if (schoolIds.length === 0) {
      return [];
    }

    const details = await this.prisma.schoolDetail.findMany({
      where: {
        schoolId: { in: schoolIds },
        deletedAt: null,
        school: { isActive: true },
      },
      include: {
        school: {
          select: { name: true },
        },
      },
      orderBy: [{ schoolId: 'asc' }],
    });

    return details.map((item) => this.mapSchoolDetails(item));
  }

  private async findSchoolDetails(schoolId: number) {
    const details = await this.prisma.schoolDetail.findFirst({
      where: {
        schoolId,
        deletedAt: null,
        school: { isActive: true },
      },
      include: {
        school: {
          select: { name: true },
        },
      },
    });

    return details ? this.mapSchoolDetails(details) : null;
  }

  private mapSchoolDetails(details: {
    id: number;
    schoolId: number;
    telephone: string;
    phone: string;
    fax: string;
    address: string;
    email: string;
    website: string;
    about: string;
    school: { name: string };
  }): SchoolDetailsResponseDto {
    return {
      id: details.id,
      schoolId: details.schoolId,
      schoolName: details.school.name,
      telephone: details.telephone,
      phone: details.phone,
      fax: details.fax,
      address: details.address,
      email: details.email,
      website: details.website,
      about: details.about,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SchoolDetailsResponseDto } from './dto/school-details-response.dto';

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  async getSchoolDetails(schoolId: number): Promise<SchoolDetailsResponseDto> {
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

    if (!details) {
      throw new NotFoundException('School details not found');
    }

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

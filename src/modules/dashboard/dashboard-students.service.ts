import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateDashboardStudentDto } from './dto/create-dashboard-student.dto';
import { DashboardStudentDetailDto } from './dto/dashboard-student-detail.dto';
import { UpdateDashboardStudentDto } from './dto/update-dashboard-student.dto';

const DEFAULT_STUDENT_PASSWORD = 'password123';

@Injectable()
export class DashboardStudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudent(
    user: AuthenticatedSchool,
    studentId: number,
  ): Promise<DashboardStudentDetailDto> {
    const student = await this.findVisibleStudent(user.schoolId, studentId);
    return this.toDetail(student);
  }

  async createStudent(
    user: AuthenticatedSchool,
    dto: CreateDashboardStudentDto,
  ): Promise<DashboardStudentDetailDto> {
    const parent = await this.findVisibleParent(user.schoolId, dto.parentId);
    const lastName = parent.person.lastName;
    const location = await this.resolveLocation(dto.governorateId, dto.regionId);
    await this.assertNationality(dto.nationalityId);

    const phoneNumber = dto.phoneNumber?.trim() || parent.person.phoneNumber || '';
    const username = await this.uniqueUsername(
      user.schoolId,
      dto.firstName,
      lastName,
      phoneNumber,
    );
    const password = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);

    try {
      const student = await this.prisma.$transaction(async (tx) => {
        const person = await tx.person.create({
          data: {
            schoolId: user.schoolId,
            username,
            password,
            firstName: dto.firstName,
            middleName: parent.person.middleName,
            lastName,
            gender: dto.gender ?? null,
            nationalityId: dto.nationalityId ?? parent.person.nationalityId,
            governorateId: location.governorateId ?? parent.person.governorateId,
            registerId: dto.registerId ?? null,
            regionId: location.regionId ?? parent.person.regionId,
            identityNumber: dto.identityNumber ?? null,
            email: dto.email ?? null,
            phoneNumber: phoneNumber || parent.person.phoneNumber,
            urgentNumber: parent.person.urgentNumber,
            landline: dto.landline ?? parent.person.landline,
            address: dto.address ?? null,
            village: dto.village ?? parent.person.village,
            placeOfBirth: dto.placeOfBirth ?? null,
            birthday: this.parseDate(dto.birthday),
          },
        });

        return tx.student.create({
          data: {
            personId: person.id,
            parentId: parent.id,
            motherName: dto.motherName ?? null,
            motherFamily: dto.motherFamily ?? null,
            motherPhone: dto.motherPhone ?? null,
          },
          include: {
            person: true,
            parent: { include: { person: true } },
          },
        });
      });

      return this.toDetail(student);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  async updateStudent(
    user: AuthenticatedSchool,
    studentId: number,
    dto: UpdateDashboardStudentDto,
  ): Promise<DashboardStudentDetailDto> {
    const existing = await this.findVisibleStudent(user.schoolId, studentId);
    const parentId = dto.parentId ?? existing.parentId;
    if (!parentId) {
      throw new BadRequestException('Parent is required');
    }

    const parent = await this.findVisibleParent(user.schoolId, parentId);
    const lastName = parent.person.lastName;
    const location = await this.resolveLocation(
      dto.governorateId !== undefined
        ? dto.governorateId
        : existing.person.governorateId ?? undefined,
      dto.regionId !== undefined
        ? dto.regionId
        : existing.person.regionId ?? undefined,
    );

    if (dto.nationalityId !== undefined) {
      await this.assertNationality(dto.nationalityId ?? undefined);
    }

    try {
      const student = await this.prisma.$transaction(async (tx) => {
        await tx.person.update({
          where: { id: existing.personId },
          data: {
            firstName: dto.firstName ?? existing.person.firstName,
            middleName: parent.person.middleName,
            lastName,
            gender:
              dto.gender !== undefined ? dto.gender : existing.person.gender,
            nationalityId:
              dto.nationalityId !== undefined
                ? dto.nationalityId
                : existing.person.nationalityId,
            governorateId: location.governorateId,
            registerId:
              dto.registerId !== undefined
                ? dto.registerId
                : existing.person.registerId,
            regionId: location.regionId,
            identityNumber:
              dto.identityNumber !== undefined
                ? dto.identityNumber
                : existing.person.identityNumber,
            email: dto.email !== undefined ? dto.email : existing.person.email,
            phoneNumber:
              dto.phoneNumber !== undefined
                ? dto.phoneNumber
                : existing.person.phoneNumber,
            urgentNumber: parent.person.urgentNumber,
            landline:
              dto.landline !== undefined
                ? dto.landline
                : existing.person.landline,
            address:
              dto.address !== undefined
                ? dto.address
                : existing.person.address,
            village:
              dto.village !== undefined
                ? dto.village
                : existing.person.village,
            placeOfBirth:
              dto.placeOfBirth !== undefined
                ? dto.placeOfBirth
                : existing.person.placeOfBirth,
            birthday:
              dto.birthday !== undefined
                ? this.parseDate(dto.birthday)
                : existing.person.birthday,
          },
        });

        return tx.student.update({
          where: { id: studentId },
          data: {
            parentId: parent.id,
            motherName:
              dto.motherName !== undefined
                ? dto.motherName
                : existing.motherName,
            motherFamily:
              dto.motherFamily !== undefined
                ? dto.motherFamily
                : existing.motherFamily,
            motherPhone:
              dto.motherPhone !== undefined
                ? dto.motherPhone
                : existing.motherPhone,
          },
          include: {
            person: true,
            parent: { include: { person: true } },
          },
        });
      });

      return this.toDetail(student);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  private async findVisibleParent(schoolId: number, parentId: number) {
    const parent = await this.prisma.parent.findFirst({
      where: {
        id: parentId,
        OR: [
          { person: { schoolId } },
          { students: { some: { person: { schoolId } } } },
        ],
      },
      include: { person: true },
    });

    if (!parent) {
      throw new NotFoundException('Parent not found');
    }

    return parent;
  }

  private async findVisibleStudent(schoolId: number, studentId: number) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        person: { schoolId },
      },
      include: {
        person: true,
        parent: { include: { person: true } },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    return student;
  }

  private toDetail(student: {
    id: number;
    parentId: number | null;
    motherName: string | null;
    motherFamily: string | null;
    motherPhone: string | null;
    person: {
      firstName: string;
      middleName: string;
      lastName: string;
      gender: number | null;
      nationalityId: number | null;
      governorateId: number | null;
      registerId: number | null;
      regionId: number | null;
      identityNumber: string | null;
      email: string | null;
      phoneNumber: string | null;
      urgentNumber: string | null;
      landline: string | null;
      address: string | null;
      village: string | null;
      placeOfBirth: string | null;
      birthday: Date | null;
    };
    parent: {
      id: number;
      person: { firstName: string; middleName: string; lastName: string };
    } | null;
  }): DashboardStudentDetailDto {
    if (!student.parent || !student.parentId) {
      throw new BadRequestException('Student has no parent');
    }

    return {
      id: student.id,
      parentId: student.parentId,
      parentName: this.formatFullName(student.parent.person),
      firstName: student.person.firstName,
      middleName: student.person.middleName,
      lastName: student.person.lastName,
      gender: student.person.gender,
      nationalityId: student.person.nationalityId,
      governorateId: student.person.governorateId,
      registerId: student.person.registerId,
      regionId: student.person.regionId,
      identityNumber: student.person.identityNumber,
      email: student.person.email,
      phoneNumber: student.person.phoneNumber,
      urgentNumber: student.person.urgentNumber,
      landline: student.person.landline,
      address: student.person.address,
      village: student.person.village,
      placeOfBirth: student.person.placeOfBirth,
      birthday: student.person.birthday
        ? student.person.birthday.toISOString().slice(0, 10)
        : null,
      motherName: student.motherName,
      motherFamily: student.motherFamily,
      motherPhone: student.motherPhone,
    };
  }

  private async resolveLocation(
    governorateId?: number,
    regionId?: number,
  ): Promise<{ governorateId: number | null; regionId: number | null }> {
    if (!regionId && !governorateId) {
      return { governorateId: null, regionId: null };
    }

    if (regionId) {
      const region = await this.prisma.region.findUnique({
        where: { id: regionId },
        select: { id: true, governorateId: true },
      });

      if (!region) {
        throw new BadRequestException('Region not found');
      }

      if (governorateId && governorateId !== region.governorateId) {
        throw new BadRequestException(
          'Region does not belong to the selected governorate',
        );
      }

      return {
        governorateId: region.governorateId,
        regionId: region.id,
      };
    }

    const governorate = await this.prisma.governorate.findUnique({
      where: { id: governorateId },
      select: { id: true },
    });

    if (!governorate) {
      throw new BadRequestException('Governorate not found');
    }

    return { governorateId: governorate.id, regionId: null };
  }

  private async assertNationality(nationalityId?: number): Promise<void> {
    if (!nationalityId) {
      return;
    }

    const nationality = await this.prisma.nationality.findUnique({
      where: { id: nationalityId },
      select: { id: true },
    });
    if (!nationality) {
      throw new BadRequestException('Nationality not found');
    }
  }

  private async uniqueUsername(
    schoolId: number,
    firstName: string,
    lastName: string,
    phoneNumber: string,
  ): Promise<string> {
    const slug = `${firstName}.${lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '')
      .replace(/^\.+|\.+$/g, '');
    const digits = phoneNumber.replace(/\D/g, '').slice(-6);
    let username = (slug || 'student') + (digits ? `.${digits}` : '');

    if (username.length > 90) {
      username = username.slice(0, 90);
    }

    const clash = await this.prisma.person.findFirst({
      where: { schoolId, username },
      select: { id: true },
    });

    if (!clash) {
      return username;
    }

    return `${username}.${Date.now().toString().slice(-6)}`.slice(0, 100);
  }

  private parseDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Birthday must be YYYY-MM-DD');
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid birthday');
    }

    return date;
  }

  private rethrowWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('A student with this username already exists');
    }

    throw error;
  }

  private formatFullName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .filter(Boolean)
      .join(' ');
  }
}

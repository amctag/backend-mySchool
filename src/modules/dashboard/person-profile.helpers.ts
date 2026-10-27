import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

export type ResolvedLocation = {
  governorateId: number | null;
  regionId: number | null;
};

/**
 * Resolves a governorate/region pair and keeps them consistent. Shared by every
 * dashboard person form (teacher, director, ...).
 */
export async function resolvePersonLocation(
  prisma: PrismaService,
  governorateId?: number | null,
  regionId?: number | null,
): Promise<ResolvedLocation> {
  if (!regionId && !governorateId) {
    return { governorateId: null, regionId: null };
  }

  if (regionId) {
    const region = await prisma.region.findUnique({
      where: { id: regionId },
      select: { id: true, governorateId: true },
    });

    if (!region) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Region not found',
        fieldErrors: { regionId: 'Region not found' },
      });
    }

    if (governorateId && governorateId !== region.governorateId) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Region does not belong to the selected governorate',
        fieldErrors: {
          regionId: 'Region does not belong to the selected governorate',
        },
      });
    }

    return {
      governorateId: region.governorateId,
      regionId: region.id,
    };
  }

  const governorate = await prisma.governorate.findUnique({
    where: { id: governorateId as number },
    select: { id: true },
  });

  if (!governorate) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Governorate not found',
      fieldErrors: { governorateId: 'Governorate not found' },
    });
  }

  return { governorateId: governorate.id, regionId: null };
}

export async function assertNationalityExists(
  prisma: PrismaService,
  nationalityId?: number | null,
): Promise<void> {
  if (!nationalityId) {
    return;
  }

  const nationality = await prisma.nationality.findUnique({
    where: { id: nationalityId },
    select: { id: true },
  });

  if (!nationality) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Nationality not found',
      fieldErrors: { nationalityId: 'Nationality not found' },
    });
  }
}

/**
 * Builds a school-scoped unique username from the person name and the last six
 * phone digits. The person logs in with this username, so it must stay unique
 * inside the school.
 */
export async function uniquePersonUsername(
  prisma: PrismaService,
  schoolId: number,
  firstName: string,
  lastName: string,
  phoneNumber: string,
  fallback = 'person',
): Promise<string> {
  const slug = `${firstName}.${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '')
    .replace(/^\.+|\.+$/g, '');
  const digits = phoneNumber.replace(/\D/g, '').slice(-6);
  let username = (slug || fallback) + (digits ? `.${digits}` : '');

  if (username.length > 90) {
    username = username.slice(0, 90);
  }

  const clash = await prisma.person.findFirst({
    where: { schoolId, username },
    select: { id: true },
  });

  if (!clash) {
    return username;
  }

  return `${username}.${Date.now().toString().slice(-6)}`.slice(0, 100);
}

export function parseIsoDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Birthday must be YYYY-MM-DD',
      fieldErrors: { birthday: 'Enter a valid date' },
    });
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid birthday',
      fieldErrors: { birthday: 'Enter a valid date' },
    });
  }

  return date;
}

export function formatIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function formatPersonFullName(person: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}): string {
  return [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(' ');
}

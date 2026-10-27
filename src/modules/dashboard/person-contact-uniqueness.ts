import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  readPrismaFieldName,
  REGISTER_ID_RANGE_MESSAGE,
} from '../../common/constants/database-limits';

export function emptyToNull(value?: string | null): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function normalizeEmail(value?: string | null): string | null {
  const trimmed = emptyToNull(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function conflict(
  message: string,
  fieldErrors?: Record<string, string>,
): ConflictException {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
}

export async function assertUniquePersonContacts(
  prisma: PrismaService,
  values: {
    email?: string | null;
    phoneNumber?: string | null;
    identityNumber?: string | null;
  },
  excludePersonId?: number,
): Promise<void> {
  const exclude = excludePersonId ? { id: { not: excludePersonId } } : {};

  if (values.email) {
    const clash = await prisma.person.findFirst({
      where: {
        ...exclude,
        email: { equals: values.email, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (clash) {
      throw conflict('This email is already used', {
        email: 'This email is already used',
      });
    }
  }

  if (values.identityNumber) {
    const clash = await prisma.person.findFirst({
      where: { ...exclude, identityNumber: values.identityNumber },
      select: { id: true },
    });
    if (clash) {
      throw conflict('This identity number is already used', {
        identityNumber: 'This identity number is already used',
      });
    }
  }
}

export function rethrowPersonWriteError(
  error: unknown,
  fallback: string,
): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = JSON.stringify(error.meta?.target ?? '');
    if (target.includes('email')) {
      throw conflict('This email is already used', {
        email: 'This email is already used',
      });
    }
    if (target.includes('identity')) {
      throw conflict('This identity number is already used', {
        identityNumber: 'This identity number is already used',
      });
    }

    throw conflict(fallback);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2020'
  ) {
    const fieldName = readPrismaFieldName(error.meta);

    if (fieldName.includes('register')) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: REGISTER_ID_RANGE_MESSAGE,
        fieldErrors: { registerId: REGISTER_ID_RANGE_MESSAGE },
      });
    }

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message:
        'A numeric value is outside the range supported by this field. Check the value and try again.',
    });
  }

  throw error;
}

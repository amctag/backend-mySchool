import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

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
      throw new ConflictException('This email is already used');
    }
  }

  if (values.identityNumber) {
    const clash = await prisma.person.findFirst({
      where: { ...exclude, identityNumber: values.identityNumber },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException('This identity number is already used');
    }
  }
}

export function rethrowPersonWriteError(error: unknown, fallback: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = JSON.stringify(error.meta?.target ?? '');
    if (target.includes('email')) {
      throw new ConflictException('This email is already used');
    }
    if (target.includes('identity')) {
      throw new ConflictException('This identity number is already used');
    }

    throw new ConflictException(fallback);
  }

  throw error;
}

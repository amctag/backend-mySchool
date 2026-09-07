import { Prisma } from '@prisma/client';

export function personNameContainsFilter(
  name?: string,
): Prisma.PersonWhereInput | undefined {
  const tokens = name
    ?.trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!tokens?.length) {
    return undefined;
  }

  const fieldOr = (value: string): Prisma.PersonWhereInput => ({
    OR: [
      { firstName: { contains: value, mode: 'insensitive' } },
      { middleName: { contains: value, mode: 'insensitive' } },
      { lastName: { contains: value, mode: 'insensitive' } },
    ],
  });

  if (tokens.length === 1) {
    return fieldOr(tokens[0]);
  }

  return {
    AND: tokens.map((token) => fieldOr(token)),
  };
}

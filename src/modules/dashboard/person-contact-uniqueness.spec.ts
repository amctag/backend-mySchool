import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertUniquePersonContacts,
  rethrowPersonWriteError,
} from './person-contact-uniqueness';
import { REGISTER_ID_RANGE_MESSAGE } from '../../common/constants/database-limits';

function prismaKnownError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '7.9.1',
    meta,
  });
}

describe('rethrowPersonWriteError', () => {
  it('turns an out-of-range register id into a 400 with a field error', () => {
    let caught: unknown;

    try {
      rethrowPersonWriteError(
        prismaKnownError('P2020', { field_name: 'register_id' }),
        'fallback',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as {
      message: string;
      fieldErrors: Record<string, string>;
    };
    expect(response.message).toBe(REGISTER_ID_RANGE_MESSAGE);
    expect(response.fieldErrors).toEqual({
      registerId: REGISTER_ID_RANGE_MESSAGE,
    });
  });

  it('keeps unique email and identity violations as 409 with field errors', () => {
    const cases = [
      { target: ['email'], field: 'email' },
      { target: ['identity_number'], field: 'identityNumber' },
    ];

    for (const item of cases) {
      let caught: unknown;
      try {
        rethrowPersonWriteError(
          prismaKnownError('P2002', { target: item.target }),
          'fallback',
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(ConflictException);
      const response = (caught as ConflictException).getResponse() as {
        fieldErrors: Record<string, string>;
      };
      expect(response.fieldErrors[item.field]).toBeTruthy();
    }
  });
});

describe('assertUniquePersonContacts', () => {
  it('returns field errors for a duplicated identity number', async () => {
    const prisma = {
      person: {
        findFirst: jest.fn().mockResolvedValue({ id: 7 }),
      },
    };

    await expect(
      assertUniquePersonContacts(prisma as never, {
        identityNumber: '123',
      }),
    ).rejects.toMatchObject({
      response: {
        fieldErrors: {
          identityNumber: 'This identity number is already used',
        },
      },
    });
  });

  it('skips the current person when checking uniqueness during an edit', async () => {
    const prisma = {
      person: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await assertUniquePersonContacts(
      prisma as never,
      { email: 'sara@example.com' },
      42,
    );

    expect(prisma.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 42 } }),
      }),
    );
  });
});

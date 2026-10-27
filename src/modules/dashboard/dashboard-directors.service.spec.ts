import { NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DashboardDirectorsService } from './dashboard-directors.service';
import type { PrismaService } from '../../database/prisma/prisma.service';
import type { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';

const user: AuthenticatedSchool = {
  id: 1,
  username: 'admin',
  role: 'school',
  schoolId: 5,
  sessionId: 'session-1',
};

const createdAt = new Date('2026-01-15T10:00:00.000Z');

function personRecord(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Sara',
    middleName: 'Nabil',
    lastName: 'Haddad',
    gender: 1,
    nationalityId: 1,
    governorateId: 2,
    registerId: 2045,
    regionId: 3,
    identityNumber: null,
    email: 'sara@example.com',
    phoneNumber: '+961 71 000 010',
    urgentNumber: null,
    landline: null,
    address: 'Hamra',
    village: 'Hamra',
    placeOfBirth: 'Beirut',
    birthday: new Date('1988-04-12T00:00:00.000Z'),
    status: true,
    ...overrides,
  };
}

function makePrisma() {
  const tx = {
    person: { create: jest.fn(), update: jest.fn() },
    director: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    directorSchool: { create: jest.fn() },
  };

  const prisma = {
    school: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 5, name: 'Green Valley', isActive: true }),
    },
    director: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    region: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, governorateId: 2 }),
    },
    governorate: {
      findUnique: jest.fn().mockResolvedValue({ id: 2 }),
    },
    nationality: { findUnique: jest.fn() },
    person: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  prisma.$transaction.mockImplementation(
    async (arg: unknown): Promise<unknown> => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (client: typeof tx) => unknown)(tx);
    },
  );

  return { prisma, tx };
}

describe('DashboardDirectorsService', () => {
  it('lists only directors linked to the authenticated school', async () => {
    const { prisma } = makePrisma();
    prisma.director.count.mockResolvedValue(1);
    prisma.director.findMany.mockResolvedValue([
      {
        id: 9,
        personId: 55,
        person: {
          firstName: 'Sara',
          middleName: 'Nabil',
          lastName: 'Haddad',
          phoneNumber: '+961 71 000 010',
          email: 'sara@example.com',
          address: 'Hamra',
          birthday: new Date('1988-04-12T00:00:00.000Z'),
          status: true,
        },
      },
    ]);

    const service = new DashboardDirectorsService(
      prisma as unknown as PrismaService,
    );
    const result = await service.listDirectors(user, { page: 2, limit: 100 });

    const listArgs = (
      prisma.director.findMany.mock.calls as unknown[][]
    )[0][0] as {
      where: { AND: unknown[] };
      skip: number;
      take: number;
    };

    expect(listArgs.skip).toBe(100);
    expect(listArgs.take).toBe(100);
    expect(listArgs.where.AND).toEqual(
      expect.arrayContaining([
        { schools: { some: { schoolId: 5, isActive: true } } },
      ]),
    );
    expect(result.items[0]).toMatchObject({
      id: 9,
      personId: 55,
      fullName: 'Sara Nabil Haddad',
      birthday: '1988-04-12',
      schoolId: 5,
      schoolName: 'Green Valley',
      isActiveInSchool: true,
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 100,
      total: 1,
      totalPages: 1,
    });
  });

  it('creates the person, director, and tenant school link in one transaction', async () => {
    const { prisma, tx } = makePrisma();
    tx.person.create.mockResolvedValue({ id: 55 });
    tx.director.create.mockResolvedValue({
      id: 9,
      personId: 55,
      createdAt,
      person: personRecord(),
    });
    tx.directorSchool.create.mockResolvedValue({ id: 1 });

    const service = new DashboardDirectorsService(
      prisma as unknown as PrismaService,
    );
    const result = await service.createDirector(user, {
      firstName: 'Sara',
      lastName: 'Haddad',
      phoneNumber: '+961 71 000 010',
      registerId: 2045,
    });

    const [personCreateArgs] = tx.person.create.mock.calls[0] as [
      {
        data: {
          schoolId: number;
          registerId: number;
          password: string;
        };
      },
    ];
    const personData = personCreateArgs.data;

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(personData.schoolId).toBe(5);
    expect(personData.registerId).toBe(2045);
    await expect(
      bcrypt.compare('password123', personData.password),
    ).resolves.toBe(true);
    expect(tx.directorSchool.create).toHaveBeenCalledWith({
      data: { directorId: 9, schoolId: 5, isActive: true },
    });
    expect(result).toMatchObject({
      id: 9,
      personId: 55,
      directorId: 9,
      schoolId: 5,
      schoolName: 'Green Valley',
    });
  });

  it('updates the linked person in place without touching login credentials', async () => {
    const { prisma, tx } = makePrisma();
    prisma.director.findFirst.mockResolvedValue({
      id: 9,
      personId: 55,
      createdAt,
      person: personRecord(),
    });
    tx.person.update.mockResolvedValue({});
    tx.director.findUniqueOrThrow.mockResolvedValue({
      id: 9,
      personId: 55,
      createdAt,
      person: personRecord({ firstName: 'Lara' }),
    });

    const service = new DashboardDirectorsService(
      prisma as unknown as PrismaService,
    );
    await service.updateDirector(user, 9, {
      firstName: 'Lara',
      registerId: 10,
    });

    const findArgs = (
      prisma.director.findFirst.mock.calls as unknown[][]
    )[0][0] as {
      where: {
        id: number;
        schools: { some: { schoolId: number; isActive: boolean } };
      };
    };
    expect(findArgs.where).toEqual(
      expect.objectContaining({
        id: 9,
        schools: { some: { schoolId: 5, isActive: true } },
      }),
    );

    const [updateArgs] = tx.person.update.mock.calls[0] as [
      {
        where: { id: number };
        data: Record<string, unknown>;
      },
    ];
    expect(updateArgs.where).toEqual({ id: 55 });
    expect(updateArgs.data.firstName).toBe('Lara');
    expect(updateArgs.data.registerId).toBe(10);
    expect(updateArgs.data).not.toHaveProperty('username');
    expect(updateArgs.data).not.toHaveProperty('password');
    expect(updateArgs.data).not.toHaveProperty('personId');
  });

  it('returns 404 for a director outside the authenticated tenant', async () => {
    const { prisma } = makePrisma();
    prisma.director.findFirst.mockResolvedValue(null);

    const service = new DashboardDirectorsService(
      prisma as unknown as PrismaService,
    );

    await expect(service.getDirector(user, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

import { Prisma } from '@prisma/client';
import { DashboardRegistrationsService } from './dashboard-registrations.service';

function registrationRow(overrides?: {
  studentPerson?: { firstName: string; middleName: string; lastName: string };
  parentPerson?: { firstName: string; lastName: string } | null;
}) {
  return {
    id: 10,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    student: {
      id: 25,
      person: overrides?.studentPerson ?? {
        firstName: 'أحمد',
        middleName: 'ignored-middle',
        lastName: 'ignored-last',
      },
      parent:
        overrides?.parentPerson === null
          ? null
          : {
              person: overrides?.parentPerson ?? {
                firstName: 'محمد',
                lastName: 'الحسن',
              },
            },
    },
    section: {
      id: 3,
      classId: 4,
      class: { className: 'Grade 4', classLevel: 4 },
      sectionTitle: { title: 'A' },
      year: { id: 2, title: '2026-2027' },
    },
  };
}

type PrismaStub = {
  registration: {
    count: {
      mock: { calls: Array<[{ where: Prisma.RegistrationWhereInput }]> };
    };
    findMany: {
      mock: {
        calls: Array<
          [
            {
              where: Prisma.RegistrationWhereInput;
              orderBy: Prisma.RegistrationOrderByWithRelationInput[];
              skip: number;
              take: number;
            },
          ]
        >;
      };
    };
  };
};

function serviceWithRows(rows: ReturnType<typeof registrationRow>[]) {
  const registration = {
    count: jest.fn().mockResolvedValue(rows.length),
    findMany: jest.fn().mockResolvedValue(rows),
  };
  const prisma = {
    $transaction: jest.fn(async (ops: [Promise<unknown>, Promise<unknown>]) =>
      Promise.all(ops),
    ),
    registration,
  };
  return {
    prisma: prisma as unknown as PrismaStub,
    service: new DashboardRegistrationsService(prisma as never),
  };
}

function countWhere(prisma: PrismaStub): Prisma.RegistrationWhereInput {
  return prisma.registration.count.mock.calls[0][0].where;
}

describe('DashboardRegistrationsService student names', () => {
  it('builds the canonical name from the Parent record, not the student person', async () => {
    const { service } = serviceWithRows([registrationRow()]);
    const result = await service.listRegistrations({ schoolId: 3 } as never, {
      page: 1,
      limit: 100,
      yearId: 2,
    });

    expect(result.items[0]).toMatchObject({
      studentId: 25,
      studentName: 'أحمد محمد الحسن',
      studentFirstName: 'أحمد',
      fatherFirstName: 'محمد',
      familyName: 'الحسن',
      studentFullName: 'أحمد محمد الحسن',
    });
  });

  it('shows father and family names when the student last_name is empty', async () => {
    const { service } = serviceWithRows([
      registrationRow({
        studentPerson: { firstName: 'راما', middleName: '', lastName: '' },
        parentPerson: { firstName: 'محمد', lastName: 'الحسن' },
      }),
    ]);
    const result = await service.listRegistrations({ schoolId: 4 } as never, {
      page: 1,
      limit: 100,
      yearId: 2,
    });

    expect(result.items[0].studentName).toBe('راما محمد الحسن');
    expect(result.items[0].studentFullName).toBe('راما محمد الحسن');
  });

  it('does not invent father names when the Parent link is missing', async () => {
    const { service } = serviceWithRows([
      registrationRow({ parentPerson: null }),
    ]);
    const result = await service.listRegistrations({ schoolId: 4 } as never, {
      page: 1,
      limit: 100,
      yearId: 2,
    });

    expect(result.items[0]).toMatchObject({
      studentFirstName: 'أحمد',
      fatherFirstName: null,
      familyName: null,
      studentFullName: 'أحمد',
    });
  });

  it('keeps school isolation in the list query', async () => {
    const { prisma, service } = serviceWithRows([registrationRow()]);
    await service.listRegistrations({ schoolId: 4 } as never, {
      page: 1,
      limit: 100,
      yearId: 2,
    });

    const where = countWhere(prisma);
    expect(where.section).toMatchObject({ schoolId: 4, yearId: 2 });
    expect(where.status).toBe(true);
  });

  it('filters first name on the student while middle/family filter on the father', async () => {
    const { prisma, service } = serviceWithRows([registrationRow()]);
    await service.listRegistrations({ schoolId: 3 } as never, {
      page: 1,
      limit: 100,
      yearId: 2,
      firstName: 'أحمد',
      middleName: 'محمد',
      lastName: 'الحسن',
    });

    const and = countWhere(prisma).AND;
    expect(and).toContainEqual({
      student: {
        person: { firstName: { contains: 'أحمد', mode: 'insensitive' } },
      },
    });
    // Father's first name — never the student's middle_name.
    expect(and).toContainEqual({
      student: {
        parent: {
          person: { firstName: { contains: 'محمد', mode: 'insensitive' } },
        },
      },
    });
    // Father's family name — never the student's last_name.
    expect(and).toContainEqual({
      student: {
        parent: {
          person: { lastName: { contains: 'الحسن', mode: 'insensitive' } },
        },
      },
    });
  });

  it('preserves pagination metadata and student sorting', async () => {
    const { prisma, service } = serviceWithRows([
      registrationRow(),
      registrationRow(),
    ]);
    const result = await service.listRegistrations({ schoolId: 3 } as never, {
      page: 2,
      limit: 1,
      yearId: 2,
      sortBy: 'student',
      sortOrder: 'asc',
    });

    expect(result.pagination).toMatchObject({ page: 2, limit: 1, total: 2 });
    const orderBy = prisma.registration.findMany.mock.calls[0][0].orderBy;
    expect(orderBy[0]).toEqual({
      student: { person: { firstName: 'asc' } },
    });
    expect(orderBy).toContainEqual({
      student: { parent: { person: { firstName: 'asc' } } },
    });
    // Pagination offsets still apply.
    expect(prisma.registration.findMany.mock.calls[0][0]).toMatchObject({
      skip: 1,
      take: 1,
    });
  });
});

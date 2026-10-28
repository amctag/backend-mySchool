import { DirectorAccessService } from './director-access.service';

describe('Director attendance options access shape', () => {
  it('selects classId required to build course options', async () => {
    const prisma = {
      section: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 7,
            classId: 3,
            yearId: 2026,
            class: { id: 3, className: 'Grade 2', stage: { title: 'Primary' } },
            sectionTitle: { title: 'A' },
            year: { id: 2026, title: '2026' },
            _count: { registrations: 0 },
          },
        ]),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) =>
        Promise.all(operations),
      ),
    };
    const service = new DirectorAccessService(prisma as never);

    const result = await service.listSectionsInSchool(11, 2026);
    const select = prisma.section.findMany.mock.calls[0][0].select;

    expect(select.classId).toBe(true);
    expect(result.sections[0].classId).toBe(3);
  });
});

import { DirectorNoticesService } from './director-notices.service';

const user = { role: 'director', schoolId: 7, personId: 99 } as any;

function setup() {
  const parentFcmNotify = { sendToPersonIds: jest.fn().mockResolvedValue(undefined) };
  const prisma: any = {
    section: { findFirst: jest.fn().mockResolvedValue({ id: 20, yearId: 3 }) },
    registration: { count: jest.fn().mockResolvedValue(1), findMany: jest.fn().mockResolvedValue([{ studentId: 1 }, { studentId: 2 }]) },
    student: { findMany: jest.fn(({ where }: any) => Promise.resolve(
      where.id.in.length === 1
        ? [{ parent: { personId: 501 } }]
        : [{ parent: { personId: 501 } }, { parent: { personId: 501 } }, { parent: { personId: 502 } }],
    )) },
    notice: { create: jest.fn(({ data }: any) => Promise.resolve({ id: 10, title: data.title, description: data.description, date: new Date('2026-10-29') })) },
  };
  const access: any = { ensureDirectorRole: jest.fn(), currentYearId: jest.fn().mockResolvedValue(3) };
  return { service: new DirectorNoticesService(prisma, access, parentFcmNotify), prisma, parentFcmNotify };
}

describe('Director notice parent notifications', () => {
  it('notifies only selected students and deduplicates parents', async () => {
    const { service, parentFcmNotify, prisma } = setup();
    await service.createNotice(user, { sectionId: 20, targetType: 'student', studentIds: [1], title: 'Remark', description: 'Please follow up', publishDate: '2026-10-29' });
    expect(prisma.registration.findMany).not.toHaveBeenCalled();
    expect(parentFcmNotify.sendToPersonIds).toHaveBeenCalledWith([501], 'Remark', 'Please follow up', { type: 'notice', noticeId: '10' });
  });

  it('notifies active registrations for section-wide notices', async () => {
    const { service, parentFcmNotify } = setup();
    await service.createNotice(user, { sectionId: 20, targetType: 'section', title: 'Section remark', description: 'Reminder', publishDate: '2026-10-29' });
    expect(parentFcmNotify.sendToPersonIds).toHaveBeenCalledWith([501, 502], 'Section remark', 'Reminder', { type: 'notice', noticeId: '10' });
  });

  it('logs notification failures without failing notice creation', async () => {
    const { service, parentFcmNotify } = setup();
    parentFcmNotify.sendToPersonIds.mockRejectedValue(new Error('FCM unavailable'));
    await expect(service.createNotice(user, { sectionId: 20, targetType: 'section', title: 'Remark', description: 'Body', publishDate: '2026-10-29' })).resolves.toMatchObject({ id: 10 });
  });
});

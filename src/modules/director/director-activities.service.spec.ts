import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DirectorActivitiesService } from './director-activities.service';

const user = { role: 'director', schoolId: 3, personId: 77 } as any;
const dto = (extra: any = {}) => ({ scopeType: 'section', classId: 8, title: 'A', content: 'B', date: '2026-10-29', ...extra });
const created = { id: 1, title: 'A', content: 'B', date: new Date('2026-10-29'), personId: 77, createdAt: new Date() };

function setup(overrides: any = {}) {
  const tx = { activity: { create: jest.fn().mockResolvedValue(created) }, activitySection: { create: jest.fn().mockResolvedValue({}) } };
  const prisma: any = { section: { findFirst: jest.fn().mockResolvedValue({ id: 8 }) }, teach: { findFirst: jest.fn().mockResolvedValue({ courseId: 4 }) }, $transaction: jest.fn((fn: any) => fn(tx)), ...overrides };
  const access: any = { ensureDirectorRole: jest.fn(), currentYearId: jest.fn().mockResolvedValue(2026) };
  return { service: new DirectorActivitiesService(prisma, access), prisma, tx, access };
}

describe('Director Activity creation', () => {
  it('creates a section activity with Director identity and atomic relation', async () => {
    const { service, tx } = setup();
    await service.createActivity(user, dto());
    expect(tx.activity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ personId: 77, yearId: 2026 }) }));
    expect(tx.activitySection.create).toHaveBeenCalledWith({ data: { activityId: 1, sectionId: 8 } });
  });
  it('rejects an invalid section', async () => {
    const { service } = setup({ section: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(service.createActivity(user, dto())).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects a missing academic year', async () => {
    const { service, access } = setup(); access.currentYearId.mockResolvedValue(null);
    await expect(service.createActivity(user, dto())).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects an invalid assignment for section_course', async () => {
    const { service, prisma } = setup(); prisma.teach.findFirst.mockResolvedValue(null);
    await expect(service.createActivity(user, dto({ scopeType: 'section_course', assignmentId: 9 }))).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('propagates transaction failure so writes roll back', async () => {
    const { service, prisma } = setup(); prisma.$transaction.mockRejectedValue(new Error('relation failure'));
    await expect(service.createActivity(user, dto())).rejects.toThrow('relation failure');
  });
});

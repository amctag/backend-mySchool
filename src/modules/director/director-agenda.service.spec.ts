import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DirectorAgendaService } from './director-agenda.service';
import { DirectorAccessService } from './director-access.service';
import { DRAFT_PUBLISHED_DATE } from './director-agenda.helpers';

const director = { role: 'director', schoolId: 7, personId: 99 } as any;

const assignment = {
  id: 10,
  sectionId: 20,
  courseId: 30,
  course: { id: 30, title: 'Math' },
  section: { class: { className: 'Grade 4' }, sectionTitle: { title: 'A' } },
};

function agendaRow(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Math',
    description: 'Lesson',
    agendaDate: new Date('2026-10-29T00:00:00.000Z'),
    time: '09:00',
    personId: 55, // original creator (a teacher)
    courseId: 30,
    imageLink: '',
    fileLink: '',
    publishedDate: DRAFT_PUBLISHED_DATE,
    createdAt: new Date('2026-10-29T08:00:00.000Z'),
    status: 0,
    ...over,
  };
}

function build() {
  const tx = {
    agenda: {
      create: jest.fn(async ({ data }) => agendaRow({ ...data, id: 1 })),
      update: jest.fn(async ({ where, data }) => agendaRow({ ...data, id: where.id })),
    },
    agendaSection: {
      create: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma: any = {
    teach: { findFirst: jest.fn(async () => assignment), findMany: jest.fn(async () => []) },
    agenda: {
      findFirst: jest.fn(async () => null),
      update: jest.fn(async ({ where, data }) => agendaRow({ ...data, id: where.id })),
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
    },
    course: { findMany: jest.fn(async () => []) },
    section: { findFirst: jest.fn(async () => ({ id: 20, yearId: 3 })) },
    registration: { findMany: jest.fn(async () => [{ studentId: 101 }, { studentId: 102 }]) },
    student: { findMany: jest.fn(async () => [{ parent: { personId: 501 } }, { parent: { personId: 501 } }]) },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  const access = new DirectorAccessService({
    year: { findFirst: jest.fn(async () => ({ id: 3 })) },
  } as any);
  const parentFcmNotify = { sendToPersonIds: jest.fn().mockResolvedValue(undefined) };
  const service = new DirectorAgendaService(prisma, access, parentFcmNotify as any);
  return { service, prisma, tx, parentFcmNotify };
}

const base = {
  assignmentId: 10,
  classId: 20,
  title: 'Math',
  description: 'Lesson',
  date: '2026-10-29',
};

describe('DirectorAgendaService.createAgenda', () => {
  it('creates a DRAFT with sentinel date and links the section atomically', async () => {
    const { service, prisma, tx } = build();
    const out = await service.createAgenda(director, { ...base, published: false });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const data = tx.agenda.create.mock.calls[0][0].data;
    expect(data.status).toBe(0);
    expect(data.publishedDate).toBe(DRAFT_PUBLISHED_DATE);
    expect(data.personId).toBe(99);
    expect(data.courseId).toBe(30);
    expect(data.imageLink).toBe('');
    expect(data.fileLink).toBe('');
    expect(data.agendaDate).toBeInstanceOf(Date);
    expect(tx.agendaSection.create).toHaveBeenCalledWith({ data: { agendaId: 1, sectionId: 20 } });
    expect(out).toMatchObject({ id: 1, assignmentId: 10, classId: 20, classLabel: 'Grade 4 - A', courseTitle: 'Math', published: false, status: 0 });
  });

  it('PUBLISHES with status 1 and a real publish timestamp', async () => {
    const { service, tx, parentFcmNotify } = build();
    const out = await service.createAgenda(director, { ...base, published: true });
    const data = tx.agenda.create.mock.calls[0][0].data;
    expect(data.status).toBe(1);
    expect(data.publishedDate.getTime()).toBeGreaterThan(Date.now() - 5000);
    expect(out.published).toBe(true);
    expect(parentFcmNotify.sendToPersonIds).toHaveBeenCalledWith([501], 'Agenda published', expect.any(String), expect.objectContaining({ type: 'agenda', route: 'agenda', agendaId: '1' }));
  });

  it.each(['2026-10-29', '2026-10-29T00:00:00.000Z', '2026-10-29T00:00:00.000'])(
    'passes a real Date (never the raw string) to Prisma for %s',
    async (date) => {
      const { service, tx } = build();
      await service.createAgenda(director, { ...base, date });
      const stored = tx.agenda.create.mock.calls[0][0].data.agendaDate;
      expect(stored).toBeInstanceOf(Date);
      expect(stored.toISOString()).toBe('2026-10-29T00:00:00.000Z');
    },
  );

  it('rejects an invalid date with 400 before any DB call', async () => {
    const { service, prisma } = build();
    await expect(service.createAgenda(director, { ...base, date: 'nope' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.teach.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an assignment/section/school/year mismatch with 400 and inserts nothing', async () => {
    const { service, prisma, tx } = build();
    prisma.teach.findFirst.mockResolvedValueOnce(null);
    await expect(service.createAgenda(director, base)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.agenda.create).not.toHaveBeenCalled();
  });

  it('scopes the assignment lookup to the director school, section and current year', async () => {
    const { service, prisma } = build();
    await service.createAgenda(director, base);
    expect(prisma.teach.findFirst.mock.calls[0][0].where).toEqual({
      id: 10,
      sectionId: 20,
      yearId: 3,
      section: { schoolId: 7 },
    });
  });

  it('rejects non-director roles', async () => {
    const { service } = build();
    await expect(service.createAgenda({ ...director, role: 'teacher' }, base)).rejects.toThrow('Director access required');
  });

  it('keeps an attachment URL and maps removal to empty string', async () => {
    const { service, tx } = build();
    await service.createAgenda(director, { ...base, imageLink: 'https://img/x.png', fileLink: '' });
    const data = tx.agenda.create.mock.calls[0][0].data;
    expect(data.imageLink).toBe('https://img/x.png');
    expect(data.fileLink).toBe('');
  });

  it('logs the real cause and returns a generic 500 for unexpected failures', async () => {
    const { service, tx } = build();
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    tx.agenda.create.mockRejectedValueOnce(new Error('Incorrect datetime value'));
    await expect(service.createAgenda(director, base)).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Incorrect datetime value'), expect.any(String));
    spy.mockRestore();
  });

  it('maps Prisma P2000 (value too long) to 400', async () => {
    const { service, tx } = build();
    const err: any = new Error('too long');
    err.name = 'PrismaClientKnownRequestError';
    err.code = 'P2000';
    tx.agenda.create.mockRejectedValueOnce(err);
    await expect(service.createAgenda(director, base)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DirectorAgendaService.updateAgenda', () => {
  function withExisting(over: Record<string, unknown> = {}) {
    const ctx = build();
    ctx.prisma.agenda.findFirst.mockResolvedValue({
      ...agendaRow(over),
      course: { schoolId: 7, title: 'Math' },
      person: { id: 55, firstName: 'Tina', lastName: 'Teacher', username: 't' },
      sections: [],
    });
    return ctx;
  }

  it('never rewrites the original creator (personId)', async () => {
    const { service, tx } = withExisting();
    await service.updateAgenda(director, 1, base);
    expect(tx.agenda.update.mock.calls[0][0].data).not.toHaveProperty('personId');
  });

  it('keeps attachments when omitted and removes them with empty string', async () => {
    const { service, tx } = withExisting({ imageLink: 'https://old/i.png', fileLink: 'https://old/f.pdf' });
    await service.updateAgenda(director, 1, base);
    let data = tx.agenda.update.mock.calls[0][0].data;
    expect(data.imageLink).toBe('https://old/i.png');
    expect(data.fileLink).toBe('https://old/f.pdf');
    await service.updateAgenda(director, 1, { ...base, imageLink: '', fileLink: '' });
    data = tx.agenda.update.mock.calls[1][0].data;
    expect(data.imageLink).toBe('');
    expect(data.fileLink).toBe('');
  });

  it('publishing a draft sets status 1; editing an already-published agenda keeps its publish date', async () => {
    const draft = withExisting({ status: 0 });
    await draft.service.updateAgenda(director, 1, { ...base, published: true });
    expect(draft.tx.agenda.update.mock.calls[0][0].data.status).toBe(1);

    const live = withExisting({ status: 1 });
    await live.service.updateAgenda(director, 1, { ...base, published: true });
    expect(live.tx.agenda.update.mock.calls[0][0].data).not.toHaveProperty('publishedDate');
    expect(live.tx.agenda.update.mock.calls[0][0].data).not.toHaveProperty('status');
  });

  it('replaces the section link in the same transaction', async () => {
    const { service, tx } = withExisting();
    await service.updateAgenda(director, 1, base);
    expect(tx.agendaSection.deleteMany).toHaveBeenCalledWith({ where: { agendaId: 1 } });
    expect(tx.agendaSection.create).toHaveBeenCalledWith({ data: { agendaId: 1, sectionId: 20 } });
  });

  it('returns 404 for another school or deleted agenda', async () => {
    const { service, prisma } = build();
    await expect(service.updateAgenda(director, 1, base)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.agenda.findFirst.mock.calls[0][0].where).toMatchObject({ deletedAt: null, course: { schoolId: 7 } });
  });
});

describe('DirectorAgendaService.publish / delete / get', () => {
  it('publish returns the real assignment, class and published status', async () => {
    const { service, prisma } = build();
    const row = {
      ...agendaRow({ status: 0 }),
      course: { schoolId: 7, title: 'Math' },
      person: null,
      sections: [{ section: { id: 20, yearId: 3, class: { className: 'Grade 4' }, sectionTitle: { title: 'A' } } }],
    };
    prisma.agenda.findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, status: 1 });
    const out = await service.publishAgenda(director, 1);
    expect(prisma.agenda.update.mock.calls[0][0].data.status).toBe(1);
    expect(out).toMatchObject({ id: 1, assignmentId: 10, classId: 20, classLabel: 'Grade 4 - A', published: true, status: 1 });
  });

  it('publish is idempotent for an already-published agenda', async () => {
    const { service, prisma } = build();
    const row = { ...agendaRow({ status: 1 }), course: { schoolId: 7, title: 'Math' }, person: null, sections: [] };
    prisma.agenda.findFirst.mockResolvedValue(row);
    await service.publishAgenda(director, 1);
    expect(prisma.agenda.update).not.toHaveBeenCalled();
  });

  it('delete is a soft delete scoped to the school', async () => {
    const { service, prisma } = build();
    prisma.agenda.findFirst.mockResolvedValueOnce({ ...agendaRow(), course: { schoolId: 7 }, person: null, sections: [] });
    await expect(service.deleteAgenda(director, 1)).resolves.toBe(true);
    expect(prisma.agenda.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('cross-school get is 404', async () => {
    const { service } = build();
    await expect(service.getAgenda(director, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});

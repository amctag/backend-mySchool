import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DirectorUpsertAgendaDto } from './director-agenda.dto';

const valid = { assignmentId: 10, classId: 20, title: 'Math', description: 'Lesson', date: '2026-10-29', published: false };
const errorsFor = async (body: object) =>
  (await validate(plainToInstance(DirectorUpsertAgendaDto, body), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property);

describe('DirectorUpsertAgendaDto', () => {
  it('accepts the Flutter contract (camelCase) in every date shape', async () => {
    for (const date of ['2026-10-29', '2026-10-29T00:00:00.000Z', '2026-10-29T00:00:00.000']) {
      expect(await errorsFor({ ...valid, date })).toEqual([]);
    }
    expect(await errorsFor({ ...valid, imageLink: '', fileLink: 'https://doc/x.pdf', time: '09:30' })).toEqual([]);
  });
  it('rejects snake_case and status keys (the original HTTP 400)', async () => {
    const props = await errorsFor({ ...valid, assignment_id: 1, class_id: 2, status: 'draft' });
    expect(props).toEqual(expect.arrayContaining(['assignment_id', 'class_id', 'status']));
  });
  it('rejects bad values', async () => {
    expect(await errorsFor({ ...valid, date: 'tomorrow' })).toContain('date');
    expect(await errorsFor({ ...valid, title: '' })).toContain('title');
    expect(await errorsFor({ ...valid, time: '99:99' })).toContain('time');
    expect(await errorsFor({ ...valid, assignmentId: 0 })).toContain('assignmentId');
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpsertTeacherActivityDto } from './dto/director-activities.dto';

describe('Director activity request contract', () => {
  it('accepts the Flutter Director payload', async () => {
    const dto = plainToInstance(UpsertTeacherActivityDto, {
      scopeType: 'section_course', assignmentId: 12, classId: 34,
      title: 'Math fair', content: 'Details', date: '2026-10-29', image: '',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects the legacy mismatched field names', async () => {
    const dto = plainToInstance(UpsertTeacherActivityDto, {
      title: 'Math fair', description: 'Details', startDate: '2026-10-29',
      courseTitle: 'Math', gradeLevels: [], sectionTitles: [],
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});

import {
  formatStudentFullName,
  studentNameFromRow,
  toStudentName,
} from './student-name';

describe('formatStudentFullName', () => {
  it('joins student first name, father first name, and family name', () => {
    expect(
      formatStudentFullName({
        studentFirstName: 'أحمد',
        fatherFirstName: 'محمد',
        familyName: 'الحسن',
      }),
    ).toBe('أحمد محمد الحسن');
  });

  it('skips missing parts without showing null or undefined', () => {
    expect(
      formatStudentFullName({
        studentFirstName: 'راما',
        fatherFirstName: null,
        familyName: undefined,
      }),
    ).toBe('راما');
  });

  it('trims whitespace-only parts', () => {
    expect(
      formatStudentFullName({
        studentFirstName: '  عمر ',
        fatherFirstName: '   ',
        familyName: 'المصري',
      }),
    ).toBe('عمر المصري');
  });
});

describe('toStudentName', () => {
  it('reads father names from the linked Parent record', () => {
    expect(
      toStudentName(
        { firstName: 'أحمد' },
        { firstName: 'محمد', lastName: 'الحسن' },
      ),
    ).toEqual({
      studentFirstName: 'أحمد',
      fatherFirstName: 'محمد',
      familyName: 'الحسن',
      studentFullName: 'أحمد محمد الحسن',
    });
  });

  it('ignores a populated student last_name', () => {
    const name = studentNameFromRow({
      person: { firstName: 'Layla' },
      parent: { person: { firstName: 'Fadi', lastName: 'Haddad' } },
    });
    expect(name.familyName).toBe('Haddad');
    expect(name.studentFullName).toBe('Layla Fadi Haddad');
  });

  it('works when the student last_name is empty (school 4 case)', () => {
    const name = studentNameFromRow({
      person: { firstName: 'راما' },
      parent: { person: { firstName: 'محمد', lastName: 'الحسن' } },
    });
    expect(name).toEqual({
      studentFirstName: 'راما',
      fatherFirstName: 'محمد',
      familyName: 'الحسن',
      studentFullName: 'راما محمد الحسن',
    });
  });

  it('never uses the student middle_name as the father first name', () => {
    const name = studentNameFromRow({
      // Row shape carries no middle_name at all; father must come from parent.
      person: { firstName: 'إبراهيم' },
      parent: null,
    });
    expect(name.fatherFirstName).toBeNull();
    expect(name.studentFullName).toBe('إبراهيم');
  });

  it('handles a missing Parent without inventing names', () => {
    expect(toStudentName({ firstName: 'عمر' }, null)).toEqual({
      studentFirstName: 'عمر',
      fatherFirstName: null,
      familyName: null,
      studentFullName: 'عمر',
    });
  });

  it('handles missing name fields safely', () => {
    expect(toStudentName({}, null)).toEqual({
      studentFirstName: null,
      fatherFirstName: null,
      familyName: null,
      studentFullName: '',
    });
  });
});

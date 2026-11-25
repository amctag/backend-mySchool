import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { DirectorGradesService } from './director-grades.service';

const director: AuthenticatedDirector = {
  id: 7,
  username: 'director',
  role: 'director',
  directorId: 3,
  personId: 41,
  schoolId: 12,
  sessionId: 'director-session',
};

function registration(
  id: number,
  studentId: number,
  studentFirstName: string,
  fatherFirstName?: string,
  familyName?: string,
) {
  return {
    id,
    studentId,
    person: null,
    student: {
      person: {
        firstName: studentFirstName,
        middleName: '',
        lastName: '',
      },
      parent:
        fatherFirstName || familyName
          ? {
              person: {
                firstName: fatherFirstName ?? '',
                lastName: familyName ?? '',
              },
            }
          : null,
    },
  };
}

function gradeSheetRow() {
  return {
    id: 81,
    sectionId: 15,
    courseId: 4,
    gradeTypeId: 2,
    maxGrade: 20,
    publishDate: null,
    gradeType: { id: 2, title: 'Exam', isMain: false },
    course: { id: 4, title: 'Mathematics' },
    section: {
      id: 15,
      classId: 6,
      yearId: 9,
      class: {
        id: 6,
        className: 'Grade 5',
        classCourses: [{ courseId: 4, yearId: 9, coefficient: 20 }],
      },
      sectionTitle: { title: 'A' },
      registrations: [
        registration(101, 501, 'أمير', 'محمد', 'أحمد'),
        registration(102, 502, 'أمير', 'علي', 'محمود'),
        registration(103, 503, 'جود', undefined, 'إبراهيم'),
        registration(104, 504, 'نور'),
        registration(105, 505, 'محمد', 'محمد', 'حسن'),
      ],
    },
    details: [{ registrationId: 102, grade: 18, comment: null }],
  };
}

describe('DirectorGradesService grade entry roster', () => {
  it('returns canonical parent-linked student names without changing roster identity or order', async () => {
    const prisma = {
      grade: { findFirst: jest.fn().mockResolvedValue(gradeSheetRow()) },
    };
    const access = { ensureDirectorRole: jest.fn() };
    const service = new DirectorGradesService(prisma as never, access as never);

    const response = await service.getEntry(director, { gradeId: 81 });

    expect(response.students).toEqual([
      {
        registrationId: 101,
        studentId: 501,
        fullName: 'أمير محمد أحمد',
        seatNumber: 1,
        score: null,
        comment: null,
      },
      {
        registrationId: 102,
        studentId: 502,
        fullName: 'أمير علي محمود',
        seatNumber: 2,
        score: 18,
        comment: null,
      },
      {
        registrationId: 103,
        studentId: 503,
        fullName: 'جود إبراهيم',
        seatNumber: 3,
        score: null,
        comment: null,
      },
      {
        registrationId: 104,
        studentId: 504,
        fullName: 'نور',
        seatNumber: 4,
        score: null,
        comment: null,
      },
      {
        registrationId: 105,
        studentId: 505,
        fullName: 'محمد حسن',
        seatNumber: 5,
        score: null,
        comment: null,
      },
    ]);
  });

  it('loads the linked parent person with the roster query', async () => {
    const prisma = {
      grade: { findFirst: jest.fn().mockResolvedValue(gradeSheetRow()) },
    };
    const access = { ensureDirectorRole: jest.fn() };
    const service = new DirectorGradesService(prisma as never, access as never);

    await service.getEntry(director, { gradeId: 81 });

    const include = prisma.grade.findFirst.mock.calls[0][0].include;
    expect(include.section.include.registrations.include.student).toEqual(
      expect.objectContaining({
        include: expect.objectContaining({
          parent: {
            select: {
              person: { select: { firstName: true, lastName: true } },
            },
          },
        }),
      }),
    );
  });
});

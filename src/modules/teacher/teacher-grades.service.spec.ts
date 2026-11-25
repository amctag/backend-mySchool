import { AuthenticatedTeacher } from '../../auth/interfaces/jwt-payload.interface';
import { TeacherGradesService } from './teacher-grades.service';

const teacher: AuthenticatedTeacher = {
  id: 8,
  username: 'teacher',
  role: 'teacher',
  teacherId: 4,
  personId: 42,
  schoolId: 12,
  sessionId: 'teacher-session',
};

describe('TeacherGradesService grade entry roster', () => {
  it('returns canonical names while preserving IDs and database ordering', async () => {
    const prisma = {
      teach: {
        findFirst: jest.fn().mockResolvedValue({
          id: 90,
          courseId: 4,
          sectionId: 15,
          course: { id: 4, title: 'Mathematics' },
          section: {
            id: 15,
            classId: 6,
            yearId: 9,
            class: { id: 6, className: 'Grade 5' },
            sectionTitle: { title: 'A' },
          },
        }),
      },
      registration: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 101,
            student: {
              id: 501,
              person: { firstName: 'أمير', middleName: '', lastName: '' },
              parent: { person: { firstName: 'محمد', lastName: 'أحمد' } },
            },
          },
          {
            id: 102,
            student: {
              id: 502,
              person: { firstName: 'أمير', middleName: '', lastName: '' },
              parent: null,
            },
          },
        ]),
      },
      grade: { findFirst: jest.fn().mockResolvedValue(null) },
      gradeType: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 2, title: 'Exam', isMain: false }),
      },
      classCourse: {
        findFirst: jest.fn().mockResolvedValue({ coefficient: 20 }),
      },
      school: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ teachersCanPublishGrades: true }),
      },
    };
    const teacherAccess = {
      ensureTeacherRole: jest.fn(),
      currentYearId: jest.fn().mockResolvedValue(9),
      isSupervisorOfSection: jest.fn().mockResolvedValue(false),
    };
    const service = new TeacherGradesService(
      prisma as never,
      teacherAccess as never,
      {} as never,
    );

    const response = await service.getEntry(teacher, {
      sectionId: 15,
      courseId: 4,
      gradeTypeId: 2,
    });

    expect(
      response.students.map(({ registrationId, studentId, fullName }) => ({
        registrationId,
        studentId,
        fullName,
      })),
    ).toEqual([
      { registrationId: 101, studentId: 501, fullName: 'أمير محمد أحمد' },
      { registrationId: 102, studentId: 502, fullName: 'أمير' },
    ]);
  });
});

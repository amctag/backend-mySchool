/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument --
   The in-memory store below is an untyped stand-in for PrismaService. */
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuthenticatedDirector,
  AuthenticatedSchool,
  AuthenticatedTeacher,
} from '../../auth/interfaces/jwt-payload.interface';
import { DirectorGradesService } from '../director/director-grades.service';
import { TeacherGradesService } from '../teacher/teacher-grades.service';
import { DashboardGradesService } from './dashboard-grades.service';

/**
 * Regression coverage for the grade card: scores saved by Teacher, Director and
 * School Admin must reach the exported card. All three real save paths write
 * into one in-memory store, and the real card reader consumes it.
 */

const SCHOOL = 4;
const OTHER_SCHOOL = 3;
const YEAR = 12;
const PREVIOUS_YEAR = 11;
const CLASS = 57;
const SECTION = 189;
const PREVIOUS_YEAR_SECTION = 150;
const OTHER_SCHOOL_SECTION = 300;

const SCIENCE = 46;
const RELIGION = 50;
const ARABIC = 45;
const READING = 341; // configured as a sub-course of ARABIC

const TERM_ONE = 176; // abstract, no expression → entered directly
const QUIZ = 70;
const EXAM = 71;
const CALCULATED = 74; // abstract with an expression over QUIZ + EXAM

const STUDENT_A = 2343;
const STUDENT_B = 2344; // same name as STUDENT_A, different student
const STUDENT_A_PREVIOUS_YEAR = 2300;
const OTHER_SCHOOL_STUDENT = 3001;

type Row = Record<string, any>;
type Where = Record<string, any>;

const dec = (value: number | null | undefined) =>
  value == null ? null : new Prisma.Decimal(value);

function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === 'OR') {
      return (expected as Where[]).some((part) => matches(row, part));
    }
    if (expected !== null && typeof expected === 'object') {
      if ('in' in expected) return expected.in.includes(row[key]);
      if ('not' in expected) return row[key] !== expected.not;
    }
    return row[key] === expected;
  });
}

class FakeGradeStore {
  sections: Row[] = [
    { id: SECTION, schoolId: SCHOOL, classId: CLASS, yearId: YEAR, status: 1 },
    {
      id: PREVIOUS_YEAR_SECTION,
      schoolId: SCHOOL,
      classId: CLASS,
      yearId: PREVIOUS_YEAR,
      status: 1,
    },
    {
      id: OTHER_SCHOOL_SECTION,
      schoolId: OTHER_SCHOOL,
      classId: 90,
      yearId: 20,
      status: 1,
    },
  ];
  registrations: Row[] = [
    { id: STUDENT_A, schoolId: SCHOOL, sectionId: SECTION, studentId: 888 },
    { id: STUDENT_B, schoolId: SCHOOL, sectionId: SECTION, studentId: 889 },
    {
      id: STUDENT_A_PREVIOUS_YEAR,
      schoolId: SCHOOL,
      sectionId: PREVIOUS_YEAR_SECTION,
      studentId: 888,
    },
    {
      id: OTHER_SCHOOL_STUDENT,
      schoolId: OTHER_SCHOOL,
      sectionId: OTHER_SCHOOL_SECTION,
      studentId: 900,
    },
  ].map((row) => ({ ...row, status: true }));
  courses: Row[] = [
    { id: SCIENCE, title: 'Science', parentId: null },
    { id: RELIGION, title: 'Religion', parentId: null },
    { id: ARABIC, title: 'Arabic', parentId: null },
    { id: READING, title: 'Reading', parentId: ARABIC },
  ];
  classCourses: Row[] = [
    { id: 1, courseId: READING, coefficient: 20, position: 1 },
    { id: 2, courseId: ARABIC, coefficient: 60, position: 2 },
    { id: 3, courseId: SCIENCE, coefficient: 20, position: 3 },
    { id: 4, courseId: RELIGION, coefficient: 20, position: 4 },
  ].map((row) => ({
    ...row,
    classId: CLASS,
    yearId: YEAR,
    status: true,
    coefficient: new Prisma.Decimal(row.coefficient),
  }));
  gradeTypes: Row[] = [
    { id: TERM_ONE, title: 'Term 1', isAbstract: true, isMain: true },
    { id: QUIZ, title: 'Quiz', isAbstract: false, isMain: false },
    { id: EXAM, title: 'Exam', isAbstract: false, isMain: false },
    { id: CALCULATED, title: 'Calculated', isAbstract: true, isMain: false },
  ].map((row) => ({ ...row, schoolId: SCHOOL, status: true }));
  gradeForm: Row = {
    id: 10,
    schoolId: SCHOOL,
    yearId: YEAR,
    classId: CLASS,
    title: 'Form',
    direction: 'rtl',
    tableFormat: 'grade_on_top',
    gradeFormatId: 1,
    average: 20,
    minimum: 10,
    status: true,
  };
  formDetails: Array<{ gradeTypeId: number; sources?: Row[] }> = [
    { gradeTypeId: TERM_ONE },
  ];
  grades: Row[] = [];
  gradeDetails: Row[] = [];
  private nextId = 1000;

  private gradeTypeById(id: number) {
    return this.gradeTypes.find((row) => row.id === id)!;
  }

  private withSheet(detail: Row) {
    return {
      ...detail,
      gradeSheet: this.grades.find((sheet) => sheet.id === detail.gradeId),
    };
  }

  /** Insert a sheet directly (used for rows only another school could write). */
  seedSheet(sheet: Row, scores: Record<number, number | null>) {
    const id = this.nextId++;
    this.grades.push({
      id,
      maxGrade: dec(20),
      publishDate: null,
      personId: 1,
      ...sheet,
    });
    for (const [registrationId, grade] of Object.entries(scores)) {
      this.gradeDetails.push({
        id: this.nextId++,
        gradeId: id,
        registrationId: Number(registrationId),
        grade: dec(grade),
        comment: null,
      });
    }
  }

  readonly client = {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(this.client),
    person: { findUnique: async () => ({ id: 1 }) },
    school: {
      findUnique: async () => ({ teachersCanPublishGrades: true }),
    },
    section: {
      findFirst: async ({ where }: { where: Where }) =>
        this.sections.find((row) => matches(row, where)) ?? null,
    },
    teach: {
      findFirst: async ({ where }: { where: Where }) => {
        const section = this.sections.find(
          (row) =>
            row.id === where.sectionId &&
            row.schoolId === where.section.schoolId,
        );
        if (!section) return null;
        return {
          id: 1,
          courseId: where.courseId,
          sectionId: section.id,
          course: this.courses.find((row) => row.id === where.courseId),
          section: {
            id: section.id,
            classId: section.classId,
            yearId: section.yearId,
            class: { id: section.classId, className: 'Class' },
            sectionTitle: { title: 'A' },
          },
        };
      },
    },
    gradeType: {
      findFirst: async ({ where }: { where: Where }) =>
        this.gradeTypes.find((row) => matches(row, where)) ?? null,
    },
    classCourse: {
      findFirst: async ({ where }: { where: Where }) =>
        this.classCourses.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }: { where: Where }) =>
        this.classCourses
          .filter((row) => matches(row, where))
          .sort((a, b) => a.position - b.position)
          .map((row) => ({
            ...row,
            course: this.courses.find((course) => course.id === row.courseId),
          })),
    },
    registration: {
      findFirst: async ({ where }: { where: Where }) => {
        const row = this.registrations.find((item) => matches(item, where));
        if (!row) return null;
        const section = this.sections.find(
          (item) => item.id === row.sectionId,
        )!;
        return {
          ...row,
          student: {
            id: row.studentId,
            person: { firstName: 'Same', middleName: '', lastName: 'Name' },
            parent: null,
          },
          section: {
            ...section,
            class: { className: 'Class' },
            sectionTitle: { title: 'A' },
            year: { id: section.yearId, title: String(section.yearId) },
          },
        };
      },
      findMany: async ({ where }: { where: Where }) =>
        this.registrations
          .filter((row) => matches(row, where))
          .map((row) => ({
            ...row,
            student: {
              id: row.studentId,
              person: { firstName: 'Same', middleName: '', lastName: 'Name' },
              parent: null,
            },
          })),
    },
    gradeForm: {
      findFirst: async ({ where }: { where: Where }) => {
        const form = this.gradeForm;
        const ok =
          form.schoolId === where.schoolId &&
          form.yearId === where.yearId &&
          form.status === where.status &&
          form.classId === where.classes.some.classId;
        return ok ? form : null;
      },
    },
    gradeFormDetail: {
      findMany: async () =>
        this.formDetails.map((detail, index) => ({
          id: 500 + index,
          gradeTypeId: detail.gradeTypeId,
          gradeFormId: this.gradeForm.id,
          position: index + 1,
          status: true,
          isVisible: true,
          gradeType: this.gradeTypeById(detail.gradeTypeId),
          percentages: (detail.sources ?? []).map((source) => ({
            sourceGradeTypeId: source.sourceGradeTypeId,
            percentage: new Prisma.Decimal(source.percentage),
          })),
        })),
    },
    grade: {
      findFirst: async ({ where }: { where: Where }) => {
        const sheet = this.grades.find((row) => matches(row, where));
        if (!sheet) return null;
        return {
          ...sheet,
          details: this.gradeDetails.filter((row) => row.gradeId === sheet.id),
        };
      },
      create: async ({ data }: { data: Row }) => {
        const row = {
          id: this.nextId++,
          ...data,
          maxGrade: dec(data.maxGrade),
        };
        this.grades.push(row);
        return row;
      },
      update: async ({ where, data }: { where: Where; data: Row }) => {
        const row = this.grades.find((item) => item.id === where.id)!;
        Object.assign(row, data, { maxGrade: dec(data.maxGrade) });
        return row;
      },
    },
    gradeDetail: {
      deleteMany: async ({ where }: { where: Where }) => {
        this.gradeDetails = this.gradeDetails.filter(
          (row) => !matches(row, where),
        );
        return { count: 0 };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { gradeId_registrationId: Where };
        create: Row;
        update: Row;
      }) => {
        const existing = this.gradeDetails.find((row) =>
          matches(row, where.gradeId_registrationId),
        );
        if (existing) {
          Object.assign(existing, update, { grade: dec(update.grade) });
          return existing;
        }
        const row = { id: this.nextId++, ...create, grade: dec(create.grade) };
        this.gradeDetails.push(row);
        return row;
      },
      findMany: async ({ where }: { where: Where }) =>
        this.gradeDetails
          .map((row) => this.withSheet(row))
          .filter(
            (row) =>
              row.registrationId === where.registrationId &&
              row.gradeSheet &&
              matches(row.gradeSheet, where.gradeSheet),
          ),
    },
  };
}

const schoolUser: AuthenticatedSchool = {
  id: 1,
  username: 'school',
  role: 'school',
  schoolId: SCHOOL,
  sessionId: 's',
};
const teacherUser: AuthenticatedTeacher = {
  id: 1992,
  username: 'teacher',
  role: 'teacher',
  teacherId: 31,
  schoolId: SCHOOL,
  sessionId: 't',
};
const directorUser = {
  id: 7,
  username: 'director',
  role: 'director',
  directorId: 3,
  personId: 41,
  schoolId: SCHOOL,
  sessionId: 'd',
} as AuthenticatedDirector;

function setup() {
  const store = new FakeGradeStore();
  const prisma = store.client as never;
  const dashboard = new DashboardGradesService(prisma);
  const teacher = new TeacherGradesService(
    prisma,
    {
      ensureTeacherRole: jest.fn(),
      currentYearId: jest.fn().mockResolvedValue(YEAR),
      isSupervisorOfSection: jest.fn().mockResolvedValue(false),
    } as never,
    {} as never,
  );
  const director = new DirectorGradesService(prisma, {
    ensureDirectorRole: jest.fn(),
  } as never);

  // Each save re-reads its own response shape; that read is not under test.
  jest.spyOn(dashboard, 'getGradeByCourse').mockResolvedValue({} as never);
  jest.spyOn(director, 'getEntry').mockResolvedValue({} as never);
  jest
    .spyOn(teacher as any, 'notifySupervisorsOfDraftGrades')
    .mockResolvedValue(undefined);

  const card = (registrationId: number, schoolId = SCHOOL) =>
    dashboard.getGradeCardForSchool(schoolId, { registrationId });
  const cell = async (
    registrationId: number,
    courseId: number,
    typeId = TERM_ONE,
  ) => (await card(registrationId)).cells[`${courseId}-${typeId}`];

  const saveAsAdmin = (
    courseId: number,
    entries: Array<{ registrationId: number; grade?: number }>,
    gradeTypeId = TERM_ONE,
  ) =>
    dashboard.saveGradeByCourse(schoolUser, {
      sectionId: SECTION,
      courseId,
      gradeTypeId,
      maxGrade: 20,
      entries,
    });

  return { store, dashboard, teacher, director, card, cell, saveAsAdmin };
}

describe('Grade card reads saved grades (directly-entered abstract type)', () => {
  it('shows teacher-created grades on the card', async () => {
    const { teacher, cell } = setup();
    await teacher.saveSheet(teacherUser, {
      sectionId: SECTION,
      courseId: SCIENCE,
      gradeTypeId: TERM_ONE,
      maxGrade: 20,
      entries: [{ registrationId: STUDENT_A, score: 18 }],
    });

    expect(await cell(STUDENT_A, SCIENCE)).toMatchObject({
      score: 18,
      maxGrade: 20,
      display: '18.00',
    });
  });

  it('shows director-created grades on the card', async () => {
    const { director, cell } = setup();
    await director.save(directorUser, {
      sectionId: SECTION,
      courseId: SCIENCE,
      gradeTypeId: TERM_ONE,
      maxGrade: 20,
      entries: [{ registrationId: STUDENT_A, score: 18 }],
    });

    expect(await cell(STUDENT_A, SCIENCE)).toMatchObject({
      score: 18,
      display: '18.00',
    });
  });

  it('shows school-admin-created grades on the card', async () => {
    const { saveAsAdmin, cell } = setup();
    await saveAsAdmin(SCIENCE, [{ registrationId: STUDENT_A, grade: 18 }]);

    expect(await cell(STUDENT_A, SCIENCE)).toMatchObject({
      score: 18,
      display: '18.00',
    });
  });

  it('loads saved scores again when a teacher reopens the sheet', async () => {
    const { teacher, saveAsAdmin } = setup();
    await saveAsAdmin(SCIENCE, [
      { registrationId: STUDENT_A, grade: 18 },
      { registrationId: STUDENT_B, grade: 0 },
    ]);

    const entry = await teacher.getEntry(teacherUser, {
      sectionId: SECTION,
      courseId: SCIENCE,
      gradeTypeId: TERM_ONE,
    });

    const scores = Object.fromEntries(
      entry.students.map((row) => [row.registrationId, row.score]),
    );
    expect(entry.gradeSheetId).not.toBeNull();
    expect(scores).toEqual({ [STUDENT_A]: 18, [STUDENT_B]: 0 });
  });

  it('reflects an edited grade instead of the original', async () => {
    const { saveAsAdmin, director, store, cell } = setup();
    await saveAsAdmin(SCIENCE, [{ registrationId: STUDENT_A, grade: 18 }]);
    await director.save(directorUser, {
      sectionId: SECTION,
      courseId: SCIENCE,
      gradeTypeId: TERM_ONE,
      maxGrade: 20,
      entries: [{ registrationId: STUDENT_A, score: 15.5 }],
    });

    expect(store.grades).toHaveLength(1);
    expect((await cell(STUDENT_A, SCIENCE))?.score).toBe(15.5);
  });

  it('keeps a saved zero as 0, not as missing', async () => {
    const { saveAsAdmin, card } = setup();
    await saveAsAdmin(SCIENCE, [{ registrationId: STUDENT_A, grade: 0 }]);

    const result = await card(STUDENT_A);
    expect(result.cells[`${SCIENCE}-${TERM_ONE}`]).toMatchObject({
      score: 0,
      display: '0.00',
    });
    const science = result.courses.find((row) => row.courseId === SCIENCE)!;
    expect(science.marksSum).toBe(0);
    expect(science.passed).toBe(false);
  });

  it('leaves courses without a saved grade empty', async () => {
    const { saveAsAdmin, card } = setup();
    await saveAsAdmin(SCIENCE, [{ registrationId: STUDENT_A, grade: 18 }]);

    const result = await card(STUDENT_A);
    expect(result.cells[`${RELIGION}-${TERM_ONE}`]).toBeUndefined();
    const religion = result.courses.find((row) => row.courseId === RELIGION)!;
    expect(religion.marksSum).toBeNull();
    expect(religion.displayAverage).toBeNull();
  });

  it('keeps two-decimal precision', async () => {
    const { saveAsAdmin, cell } = setup();
    await saveAsAdmin(SCIENCE, [{ registrationId: STUDENT_A, grade: 17.25 }]);

    expect(await cell(STUDENT_A, SCIENCE)).toMatchObject({
      score: 17.25,
      display: '17.25',
    });
  });

  it('keeps grades on the right student when two students share a name', async () => {
    const { saveAsAdmin, card } = setup();
    await saveAsAdmin(SCIENCE, [
      { registrationId: STUDENT_A, grade: 18 },
      { registrationId: STUDENT_B, grade: 7 },
    ]);

    const [a, b] = await Promise.all([card(STUDENT_A), card(STUDENT_B)]);
    expect(a.student.studentName).toBe(b.student.studentName);
    expect(a.cells[`${SCIENCE}-${TERM_ONE}`]?.score).toBe(18);
    expect(b.cells[`${SCIENCE}-${TERM_ONE}`]?.score).toBe(7);
  });
});

describe('Grade card calculations', () => {
  it('applies the configured form average and minimum to totals', async () => {
    const { saveAsAdmin, card } = setup();
    await saveAsAdmin(SCIENCE, [{ registrationId: STUDENT_A, grade: 18 }]);
    await saveAsAdmin(RELIGION, [{ registrationId: STUDENT_A, grade: 13 }]);

    const result = await card(STUDENT_A);
    const science = result.courses.find((row) => row.courseId === SCIENCE)!;
    // Course: marks / sheet max × form average (20).
    expect(science).toMatchObject({
      marksSum: 18,
      scaledAverage: 18,
      passed: true,
    });
    // Grade-type row: marks sum / coefficients total (120) × 20; min 10.
    expect(result.coefficientsTotal).toBe(120);
    expect(result.gradeTypes[0]).toMatchObject({
      marksSum: 31,
      scaledAverage: 5.17,
      passed: false,
    });
  });

  it('treats parent and sub-courses as independent columns (no roll-up)', async () => {
    const { saveAsAdmin, card } = setup();
    await saveAsAdmin(READING, [{ registrationId: STUDENT_A, grade: 15 }]);

    const result = await card(STUDENT_A);
    expect(result.cells[`${READING}-${TERM_ONE}`]?.score).toBe(15);
    expect(result.cells[`${ARABIC}-${TERM_ONE}`]).toBeUndefined();
    expect(result.coefficientsTotal).toBe(20 + 60 + 20 + 20);
  });

  it('still calculates an abstract type that has an expression and ignores its raw scores', async () => {
    const { store, saveAsAdmin, card } = setup();
    store.formDetails = [
      { gradeTypeId: QUIZ },
      { gradeTypeId: EXAM },
      {
        gradeTypeId: CALCULATED,
        sources: [
          { sourceGradeTypeId: QUIZ, percentage: 50 },
          { sourceGradeTypeId: EXAM, percentage: 50 },
        ],
      },
    ];
    await saveAsAdmin(
      SCIENCE,
      [{ registrationId: STUDENT_A, grade: 10 }],
      QUIZ,
    );
    await saveAsAdmin(
      SCIENCE,
      [{ registrationId: STUDENT_A, grade: 20 }],
      EXAM,
    );
    await saveAsAdmin(
      SCIENCE,
      [{ registrationId: STUDENT_A, grade: 2 }],
      CALCULATED,
    );

    const result = await card(STUDENT_A);
    expect(result.cells[`${SCIENCE}-${CALCULATED}`]?.score).toBe(15);
    // The calculated type is not counted again in the course total.
    expect(
      result.courses.find((row) => row.courseId === SCIENCE)?.marksSum,
    ).toBe(30);
  });
});

describe('Grade card isolation', () => {
  it('refuses a registration that belongs to another school', async () => {
    const { card } = setup();
    await expect(card(OTHER_SCHOOL_STUDENT)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ignores grade rows stored under another school', async () => {
    const { store, cell } = setup();
    store.seedSheet(
      {
        schoolId: OTHER_SCHOOL,
        sectionId: SECTION,
        courseId: SCIENCE,
        gradeTypeId: TERM_ONE,
      },
      { [STUDENT_A]: 19 },
    );

    expect(await cell(STUDENT_A, SCIENCE)).toBeUndefined();
  });

  it("ignores the same student's grades from another academic year", async () => {
    const { store, cell, card } = setup();
    store.seedSheet(
      {
        schoolId: SCHOOL,
        sectionId: PREVIOUS_YEAR_SECTION,
        courseId: SCIENCE,
        gradeTypeId: TERM_ONE,
      },
      { [STUDENT_A_PREVIOUS_YEAR]: 11, [STUDENT_A]: 11 },
    );

    expect(await cell(STUDENT_A, SCIENCE)).toBeUndefined();
    // The previous-year card has no grade form for that year, so no columns.
    expect((await card(STUDENT_A_PREVIOUS_YEAR)).gradeTypes).toEqual([]);
  });
});

describe('Individual vs bulk export', () => {
  it('returns the same card per student whether loaded alone or as a batch', async () => {
    const { saveAsAdmin, card, dashboard } = setup();
    await saveAsAdmin(SCIENCE, [
      { registrationId: STUDENT_A, grade: 18 },
      { registrationId: STUDENT_B, grade: 0 },
    ]);

    // Print All issues one grade-card request per filtered registration.
    const batch = await Promise.all(
      [STUDENT_A, STUDENT_B].map((registrationId) =>
        dashboard.getGradeCard(schoolUser, {
          registrationId,
          yearId: YEAR,
          classId: CLASS,
          sectionId: SECTION,
        }),
      ),
    );

    expect(batch[0]).toEqual(await card(STUDENT_A));
    expect(batch[1]).toEqual(await card(STUDENT_B));
  });
});

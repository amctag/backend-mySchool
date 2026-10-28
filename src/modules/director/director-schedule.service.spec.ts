import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { DirectorScheduleService } from './director-schedule.service';
import { DirectorScheduleMode } from './dto/director-schedule.dto';

const director: AuthenticatedDirector = {
  id: 2,
  username: 'monzer.mahfouz.887115',
  role: 'director',
  directorId: 2,
  personId: 3538,
  schoolId: 1,
  sessionId: 'director-session',
};

const year = { id: 3, title: '2026-2027' };

const days = [
  { id: 1, dayName: 'Monday', position: 1 },
  { id: 5, dayName: 'Tuesday', position: 2 },
  { id: 2, dayName: 'Wednesday', position: 3 },
  { id: 3, dayName: 'Thursday', position: 4 },
  { id: 4, dayName: 'Friday', position: 5 },
  { id: 11, dayName: 'saturday', position: 6 },
];

const sessions = [
  { id: 1, sessionName: 'Session 1', position: 1 },
  { id: 2, sessionName: 'Session 2', position: 2 },
  { id: 6, sessionName: 'Session 3', position: 3 },
  { id: 3, sessionName: 'Session 4', position: 4 },
];

function detail(overrides: {
  id: number;
  day: { id: number; dayName: string; position: number };
  session: { id: number; sessionName: string; position: number };
  course: { id: number; title: string };
  section: {
    id: number;
    classId: number;
    yearId: number;
    className: string;
    sectionTitle: string;
  };
  person?: {
    id: number;
    firstName: string;
    middleName: string | null;
    lastName: string;
  } | null;
  note?: string | null;
}) {
  return {
    id: overrides.id,
    courseId: overrides.course.id,
    personId: overrides.person?.id ?? null,
    note: overrides.note ?? null,
    day: overrides.day,
    session: overrides.session,
    course: overrides.course,
    person: overrides.person ?? null,
    schedule: {
      id: 100,
      sectionId: overrides.section.id,
      section: {
        id: overrides.section.id,
        classId: overrides.section.classId,
        yearId: overrides.section.yearId,
        class: {
          id: overrides.section.classId,
          className: overrides.section.className,
        },
        sectionTitle: { title: overrides.section.sectionTitle },
      },
    },
  };
}

function createPrisma() {
  return {
    year: { findFirst: jest.fn().mockResolvedValue(year) },
    section: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    teacher: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    day: { findMany: jest.fn().mockResolvedValue(days) },
    session: { findMany: jest.fn().mockResolvedValue(sessions) },
    weeklyScheduleDetail: { findMany: jest.fn().mockResolvedValue([]) },
    teach: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
}

function createService(prisma: ReturnType<typeof createPrisma>) {
  const access = {
    ensureDirectorRole: jest.fn(),
  };
  return new DirectorScheduleService(prisma as never, access as never);
}

const grade2A = {
  id: 3,
  classId: 1,
  yearId: 3,
  className: 'Grade 2',
  sectionTitle: 'A',
};

const grade3B = {
  id: 5,
  classId: 2,
  yearId: 3,
  className: 'Grade 3',
  sectionTitle: 'B',
};

const nabil = {
  id: 1320,
  firstName: 'Nabil',
  middleName: null,
  lastName: 'Haddad',
};

const sara = {
  id: 1321,
  firstName: 'Sara',
  middleName: 'M.',
  lastName: 'Mansour',
};

describe('DirectorScheduleService', () => {
  describe('class schedule', () => {
    it('returns only the selected section timetable with real weekdays', async () => {
      const prisma = createPrisma();
      prisma.section.findFirst.mockResolvedValue({
        id: grade2A.id,
        classId: grade2A.classId,
        yearId: grade2A.yearId,
        class: { id: grade2A.classId, className: grade2A.className },
        sectionTitle: { title: grade2A.sectionTitle },
      });
      prisma.weeklyScheduleDetail.findMany.mockResolvedValue([
        detail({
          id: 62,
          day: days[0],
          session: sessions[0],
          course: { id: 1, title: 'Mathematics' },
          section: grade2A,
          person: nabil,
        }),
        detail({
          id: 63,
          day: days[1],
          session: sessions[1],
          course: { id: 2, title: 'Arabic' },
          section: grade2A,
          person: sara,
        }),
        // Same section, same day, another period: must never be dropped.
        detail({
          id: 64,
          day: days[0],
          session: sessions[2],
          course: { id: 1, title: 'Mathematics' },
          section: grade2A,
          person: nabil,
        }),
      ]);
      prisma.teach.findMany.mockResolvedValue([
        {
          teacherId: 1,
          courseId: 1,
          teacher: { personId: nabil.id, person: nabil },
        },
      ]);

      const service = createService(prisma);
      const result = await service.getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Class,
        sectionId: grade2A.id,
      });

      expect(result.mode).toBe(DirectorScheduleMode.Class);
      expect(result.year).toEqual(year);
      expect(result.ownerLabel).toBe('Grade 2 - A');
      expect(result.sectionId).toBe(grade2A.id);
      expect(result.entryCount).toBe(3);
      expect(result.days.map((day) => day.dayName)).toEqual([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'saturday',
      ]);
      expect(result.days[0].entries.map((entry) => entry.detailId)).toEqual([
        62, 64,
      ]);
      expect(result.days[1].entries).toHaveLength(1);
      expect(result.days[1].entries[0]).toMatchObject({
        courseTitle: 'Arabic',
        teacherName: 'Sara M. Mansour',
        periodNumber: 2,
        classLabel: 'Grade 2 - A',
      });
      expect(result.days[2].entries).toEqual([]);

      // Section is resolved inside the director's school and active year.
      expect(prisma.section.findFirst.mock.calls[0][0].where).toEqual({
        id: grade2A.id,
        schoolId: director.schoolId,
        yearId: year.id,
      });
      // Schedule cells are scoped to that section only.
      expect(
        prisma.weeklyScheduleDetail.findMany.mock.calls[0][0].where,
      ).toEqual({
        schedule: {
          sectionId: grade2A.id,
          section: { schoolId: director.schoolId, yearId: year.id },
        },
      });
    });

    it('orders entries by session position, not by insertion order', async () => {
      const prisma = createPrisma();
      prisma.section.findFirst.mockResolvedValue({
        id: grade2A.id,
        classId: grade2A.classId,
        yearId: grade2A.yearId,
        class: { id: grade2A.classId, className: grade2A.className },
        sectionTitle: { title: grade2A.sectionTitle },
      });
      prisma.weeklyScheduleDetail.findMany.mockResolvedValue([
        detail({
          id: 90,
          day: days[0],
          session: sessions[3],
          course: { id: 9, title: 'History' },
          section: grade2A,
          person: nabil,
        }),
        detail({
          id: 91,
          day: days[0],
          session: sessions[0],
          course: { id: 1, title: 'Mathematics' },
          section: grade2A,
          person: nabil,
        }),
        detail({
          id: 92,
          day: days[0],
          session: sessions[1],
          course: { id: 2, title: 'Arabic' },
          section: grade2A,
          person: nabil,
        }),
      ]);

      const service = createService(prisma);
      const result = await service.getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Class,
        sectionId: grade2A.id,
      });

      expect(
        result.days[0].entries.map((entry) => entry.periodNumber),
      ).toEqual([1, 2, 4]);
      expect(
        prisma.session.findMany.mock.calls[0][0].orderBy,
      ).toEqual([{ position: 'asc' }, { id: 'asc' }]);
      expect(prisma.day.findMany.mock.calls[0][0].orderBy).toEqual([
        { position: 'asc' },
        { id: 'asc' },
      ]);
    });

    it('falls back to the Teach row when a schedule cell has no person', async () => {
      const prisma = createPrisma();
      prisma.section.findFirst.mockResolvedValue({
        id: grade2A.id,
        classId: grade2A.classId,
        yearId: grade2A.yearId,
        class: { id: grade2A.classId, className: grade2A.className },
        sectionTitle: { title: grade2A.sectionTitle },
      });
      prisma.weeklyScheduleDetail.findMany.mockResolvedValue([
        detail({
          id: 70,
          day: days[0],
          session: sessions[0],
          course: { id: 1, title: 'Mathematics' },
          section: grade2A,
          person: null,
        }),
      ]);
      prisma.teach.findMany.mockResolvedValue([
        {
          teacherId: 1,
          courseId: 1,
          teacher: { personId: nabil.id, person: nabil },
        },
      ]);

      const result = await createService(prisma).getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Class,
        sectionId: grade2A.id,
      });

      expect(result.days[0].entries[0]).toMatchObject({
        teacherId: 1,
        teacherPersonId: nabil.id,
        teacherName: 'Nabil Haddad',
      });
    });

    it('returns an empty timetable instead of failing when the section has no lessons', async () => {
      const prisma = createPrisma();
      prisma.section.findFirst.mockResolvedValue({
        id: grade2A.id,
        classId: grade2A.classId,
        yearId: grade2A.yearId,
        class: { id: grade2A.classId, className: grade2A.className },
        sectionTitle: { title: grade2A.sectionTitle },
      });

      const result = await createService(prisma).getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Class,
        sectionId: grade2A.id,
      });

      expect(result.entryCount).toBe(0);
      expect(result.days).toHaveLength(days.length);
      expect(result.days.every((day) => day.entries.length === 0)).toBe(true);
      expect(result.ownerLabel).toBe('Grade 2 - A');
    });

    it('returns an empty timetable when the school has no academic year', async () => {
      const prisma = createPrisma();
      prisma.year.findFirst.mockResolvedValue(null);

      const result = await createService(prisma).getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Class,
        sectionId: grade2A.id,
      });

      expect(result.year).toBeNull();
      expect(result.days).toEqual([]);
      expect(result.entryCount).toBe(0);
      expect(prisma.weeklyScheduleDetail.findMany).not.toHaveBeenCalled();
    });

    it('rejects a section from another school or year', async () => {
      const prisma = createPrisma();
      prisma.section.findFirst.mockResolvedValue(null);

      await expect(
        createService(prisma).getWeeklySchedule(director, {
          mode: DirectorScheduleMode.Class,
          sectionId: 999,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.section.findFirst.mock.calls[0][0].where).toMatchObject({
        schoolId: director.schoolId,
        yearId: year.id,
      });
    });

    it('requires a section id', async () => {
      const prisma = createPrisma();

      await expect(
        createService(prisma).getWeeklySchedule(director, {
          mode: DirectorScheduleMode.Class,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.weeklyScheduleDetail.findMany).not.toHaveBeenCalled();
    });
  });

  describe('teacher schedule', () => {
    it('merges multiple teaching assignments without mixing sections', async () => {
      const prisma = createPrisma();
      prisma.teacher.findFirst.mockResolvedValue({
        id: 1,
        personId: nabil.id,
        person: nabil,
      });
      prisma.teach.findMany.mockResolvedValue([
        { id: 1, sectionId: grade2A.id, courseId: 1 },
        { id: 2, sectionId: grade3B.id, courseId: 5 },
      ]);
      prisma.weeklyScheduleDetail.findMany
        .mockResolvedValueOnce([
          detail({
            id: 62,
            day: days[0],
            session: sessions[0],
            course: { id: 1, title: 'Mathematics' },
            section: grade2A,
            person: nabil,
          }),
          detail({
            id: 63,
            day: days[0],
            session: sessions[1],
            course: { id: 1, title: 'Mathematics' },
            section: grade2A,
            person: nabil,
          }),
          // A lesson of another teacher in the same section is not this
          // teacher's entry.
          detail({
            id: 64,
            day: days[1],
            session: sessions[0],
            course: { id: 2, title: 'Arabic' },
            section: grade2A,
            person: sara,
          }),
          detail({
            id: 65,
            day: days[2],
            session: sessions[0],
            course: { id: 5, title: 'History' },
            section: grade3B,
            person: nabil,
          }),
        ])
        .mockResolvedValueOnce([]);

      const result = await createService(prisma).getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Teacher,
        teacherId: 1,
      });

      expect(result.mode).toBe(DirectorScheduleMode.Teacher);
      expect(result.ownerLabel).toBe('Nabil Haddad');
      expect(result.entryCount).toBe(3);
      expect(result.days[0].entries).toHaveLength(2);
      expect(result.days[1].entries).toEqual([]);
      expect(result.days[2].entries[0]).toMatchObject({
        courseTitle: 'History',
        classLabel: 'Grade 3 - B',
        className: 'Grade 3',
        sectionTitle: 'B',
        periodNumber: 1,
      });

      expect(prisma.teacher.findFirst.mock.calls[0][0].where).toEqual({
        id: 1,
        schools: { some: { schoolId: director.schoolId, isActive: true } },
      });
      expect(prisma.teach.findMany.mock.calls[0][0].where).toEqual({
        teacherId: 1,
        yearId: year.id,
        section: { schoolId: director.schoolId, yearId: year.id },
      });
      expect(
        prisma.weeklyScheduleDetail.findMany.mock.calls[0][0].where,
      ).toEqual({
        schedule: {
          sectionId: { in: [grade2A.id, grade3B.id] },
          section: { schoolId: director.schoolId, yearId: year.id },
        },
      });
    });

    it('includes cells assigned to the teacher person and de-duplicates them', async () => {
      const prisma = createPrisma();
      prisma.teacher.findFirst.mockResolvedValue({
        id: 1,
        personId: nabil.id,
        person: nabil,
      });
      prisma.teach.findMany.mockResolvedValue([
        { id: 1, sectionId: grade2A.id, courseId: 1 },
      ]);
      const sharedCell = detail({
        id: 62,
        day: days[0],
        session: sessions[0],
        course: { id: 1, title: 'Mathematics' },
        section: grade2A,
        person: nabil,
      });
      const personOnlyCell = detail({
        id: 77,
        day: days[1],
        session: sessions[1],
        course: { id: 9, title: 'Science' },
        section: grade2A,
        person: nabil,
      });
      prisma.weeklyScheduleDetail.findMany
        .mockResolvedValueOnce([sharedCell])
        .mockResolvedValueOnce([sharedCell, personOnlyCell]);

      const result = await createService(prisma).getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Teacher,
        teacherId: 1,
      });

      expect(result.entryCount).toBe(2);
      expect(result.days[0].entries.map((entry) => entry.detailId)).toEqual([
        62,
      ]);
      expect(result.days[1].entries.map((entry) => entry.detailId)).toEqual([
        77,
      ]);
      expect(
        prisma.weeklyScheduleDetail.findMany.mock.calls[1][0].where,
      ).toEqual({
        personId: nabil.id,
        schedule: {
          section: { schoolId: director.schoolId, yearId: year.id },
        },
      });
    });

    it('returns an empty timetable for a teacher with no assignments', async () => {
      const prisma = createPrisma();
      prisma.teacher.findFirst.mockResolvedValue({
        id: 2,
        personId: sara.id,
        person: sara,
      });

      const result = await createService(prisma).getWeeklySchedule(director, {
        mode: DirectorScheduleMode.Teacher,
        teacherId: 2,
      });

      expect(result.entryCount).toBe(0);
      expect(result.days).toHaveLength(days.length);
      expect(result.teacherName).toBe('Sara M. Mansour');
      // No Teach rows means no section query; only the cells explicitly
      // assigned to this person are checked.
      expect(prisma.weeklyScheduleDetail.findMany).toHaveBeenCalledTimes(1);
      expect(
        prisma.weeklyScheduleDetail.findMany.mock.calls[0][0].where,
      ).toEqual({
        personId: sara.id,
        schedule: {
          section: { schoolId: director.schoolId, yearId: year.id },
        },
      });
    });

    it('rejects a teacher outside the director school', async () => {
      const prisma = createPrisma();
      prisma.teacher.findFirst.mockResolvedValue(null);

      await expect(
        createService(prisma).getWeeklySchedule(director, {
          mode: DirectorScheduleMode.Teacher,
          teacherId: 99,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.teach.findMany).not.toHaveBeenCalled();
    });

    it('requires a teacher id', async () => {
      await expect(
        createService(createPrisma()).getWeeklySchedule(director, {
          mode: DirectorScheduleMode.Teacher,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('options', () => {
    it('groups sections by class and lists school teachers for the active year', async () => {
      const prisma = createPrisma();
      prisma.section.findMany.mockResolvedValue([
        {
          id: 1,
          classId: 1,
          class: { id: 1, className: 'Grade 2', position: 1 },
          sectionTitle: { title: 'A' },
          _count: { registrations: 24 },
        },
        {
          id: 2,
          classId: 1,
          class: { id: 1, className: 'Grade 2', position: 1 },
          sectionTitle: { title: 'B' },
          _count: { registrations: 20 },
        },
        {
          id: 5,
          classId: 2,
          class: { id: 2, className: 'Grade 3', position: 2 },
          sectionTitle: { title: 'A' },
          _count: { registrations: 18 },
        },
      ]);
      prisma.teacher.findMany.mockResolvedValue([
        {
          id: 1,
          personId: nabil.id,
          person: {
            username: 'nabil.haddad',
            firstName: 'Nabil',
            middleName: null,
            lastName: 'Haddad',
          },
        },
      ]);

      const result = await createService(prisma).getOptions(director, {});

      expect(result.year).toEqual(year);
      expect(result.classes).toHaveLength(2);
      expect(result.classes[0]).toEqual({
        classId: 1,
        className: 'Grade 2',
        sections: [
          {
            sectionId: 1,
            classId: 1,
            className: 'Grade 2',
            sectionTitle: 'A',
            classLabel: 'Grade 2 - A',
            studentCount: 24,
          },
          {
            sectionId: 2,
            classId: 1,
            className: 'Grade 2',
            sectionTitle: 'B',
            classLabel: 'Grade 2 - B',
            studentCount: 20,
          },
        ],
      });
      expect(result.teachers).toEqual([
        {
          teacherId: 1,
          personId: nabil.id,
          fullName: 'Nabil Haddad',
          username: 'nabil.haddad',
        },
      ]);

      expect(prisma.section.findMany.mock.calls[0][0].where).toEqual({
        schoolId: director.schoolId,
        yearId: year.id,
      });
      expect(prisma.teacher.findMany.mock.calls[0][0].where).toEqual({
        schools: { some: { schoolId: director.schoolId, isActive: true } },
      });
      expect(prisma.year.findFirst.mock.calls[0][0].orderBy).toEqual([
        { isCurrent: 'desc' },
        { id: 'desc' },
      ]);
    });

    it('rejects a year that does not belong to the director school', async () => {
      const prisma = createPrisma();
      prisma.year.findFirst.mockResolvedValue(null);

      await expect(
        createService(prisma).getOptions(director, { yearId: 999 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

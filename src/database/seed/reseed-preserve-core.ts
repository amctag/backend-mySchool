import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { STANDARD_CLASSES } from '../standard-classes';
import { seedLookups } from './seed-lookups';
import { SeedPrismaClient } from './seed-prisma.client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const prisma = new SeedPrismaClient(connectionString);

const PRESERVED_PERSON_ID = 1;
const DEFAULT_PASSWORD = bcrypt.hashSync('password123', 10);
const CURRENT_YEAR_TITLE = '2026-2027';
const MAX_WEEKLY_HOURS = 30;

/** Weekly hours per course — total across all courses = 30 (max weekly schedule) */
const COURSES = [
  { title: 'Mathematics', hours: 5, maxGrade: 20 },
  { title: 'Arabic', hours: 5, maxGrade: 20 },
  { title: 'English', hours: 4, maxGrade: 20 },
  { title: 'Science', hours: 4, maxGrade: 20 },
  { title: 'Physics', hours: 3, maxGrade: 20 },
  { title: 'Chemistry', hours: 2, maxGrade: 20 },
  { title: 'History', hours: 2, maxGrade: 15 },
  { title: 'Geography', hours: 2, maxGrade: 15 },
  { title: 'Computer Science', hours: 2, maxGrade: 20 },
  { title: 'Physical Education', hours: 1, maxGrade: 10 },
] as const;

type GradeSectionSeed = {
  sectionId: number;
  classId: number;
  classLevel: number;
  sectionCode: 'a' | 'b';
};

async function seedWeeklyScheduleForSection(
  section: GradeSectionSeed,
  yearId: number,
  schoolId: number,
  days: Array<{ id: number }>,
  sessions: Array<{ id: number }>,
): Promise<number> {
  const classCourses = await prisma.classCourse.findMany({
    where: {
      classId: section.classId,
      yearId,
      status: true,
      course: { schoolId },
    },
    orderBy: { position: 'asc' },
  });

  const schedule = await prisma.weeklySchedule.create({
    data: { sectionId: section.sectionId },
  });

  const maxSlots = days.length * sessions.length;
  let slotIndex = 0;
  let totalHours = 0;

  for (const classCourse of classCourses) {
    const teach = await prisma.teach.findFirst({
      where: {
        sectionId: section.sectionId,
        courseId: classCourse.courseId,
        yearId,
      },
      include: { teacher: true },
    });
    if (!teach) continue;

    const courseHours = classCourse.numberOfHours ?? 0;
    for (let hour = 0; hour < courseHours; hour += 1) {
      if (totalHours >= MAX_WEEKLY_HOURS || slotIndex >= maxSlots) {
        return totalHours;
      }

      const day = days[slotIndex % days.length];
      const session =
        sessions[Math.floor(slotIndex / days.length) % sessions.length];

      await prisma.weeklyScheduleDetail.create({
        data: {
          scheduleId: schedule.id,
          dayId: day.id,
          sessionId: session.id,
          courseId: classCourse.courseId,
          personId: teach.teacher.personId,
        },
      });

      slotIndex += 1;
      totalHours += 1;
    }
  }

  return totalHours;
}

function maxGradeForClassCourse(
  courseTitle: string,
  classLevel: number,
): number {
  const course = COURSES.find((item) => item.title === courseTitle);
  const base = course?.maxGrade ?? 20;

  // Primary (Grade 1–3): cap most subjects at 10; PE stays 10
  if (classLevel <= 3) {
    if (courseTitle === 'Physical Education') return 10;
    if (courseTitle === 'History' || courseTitle === 'Geography') return 10;
    return Math.min(base, 10);
  }

  // Grade 4–6: history/geography at 15, others at full max
  if (classLevel <= 6) {
    if (courseTitle === 'History' || courseTitle === 'Geography') return 15;
    if (courseTitle === 'Physical Education') return 10;
    return base;
  }

  return base;
}

const SESSION_NAMES = [
  'Session 1',
  'Session 2',
  'Session 3',
  'Session 4',
  'Session 5',
  'Session 6',
  'Session 7',
] as const;

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

const GRADE_FORM_CLASS_NAMES = [
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
] as const;

const TEACHERS = [
  { username: 'nabil.haddad', firstName: 'Nabil', middleName: 'Georges', lastName: 'Haddad', email: 'nabil.haddad@greenvalley.edu', gender: 0 },
  { username: 'sara.mansour', firstName: 'Sara', middleName: 'Michel', lastName: 'Mansour', email: 'sara.mansour@greenvalley.edu', gender: 1 },
  { username: 'karim.khoury', firstName: 'Karim', middleName: 'Antoine', lastName: 'Khoury', email: 'karim.khoury@greenvalley.edu', gender: 0 },
  { username: 'layla.fares', firstName: 'Layla', middleName: 'Joseph', lastName: 'Fares', email: 'layla.fares@greenvalley.edu', gender: 1 },
  { username: 'omar.saad', firstName: 'Omar', middleName: 'Hassan', lastName: 'Saad', email: 'omar.saad@greenvalley.edu', gender: 0 },
  { username: 'rania.gemayel', firstName: 'Rania', middleName: 'Fadi', lastName: 'Gemayel', email: 'rania.gemayel@greenvalley.edu', gender: 1 },
  { username: 'fadi.aboukhalil', firstName: 'Fadi', middleName: 'Elias', lastName: 'Abou Khalil', email: 'fadi.aboukhalil@greenvalley.edu', gender: 0 },
  { username: 'maha.yammine', firstName: 'Maha', middleName: 'Nabil', lastName: 'Yammine', email: 'maha.yammine@greenvalley.edu', gender: 1 },
] as const;

const PARENTS = [
  { username: 'ahmad.khalil', firstName: 'Ahmad', middleName: 'Hassan', lastName: 'Khalil', email: 'ahmad.khalil@example.com', phone: '+96170111222', global: true },
  { username: 'maya.hassan', firstName: 'Maya', middleName: 'Joseph', lastName: 'Hassan', email: 'maya.hassan@example.com', phone: '+96170333444', global: false },
  { username: 'georges.njeim', firstName: 'Georges', middleName: 'Maroun', lastName: 'Njeim', email: 'georges.njeim@example.com', phone: '+96170555666', global: false },
] as const;

const STUDENT_FIRST_NAMES = [
  'Layla', 'Omar', 'Rana', 'Adam', 'Mira',
  'Ziad', 'Nour', 'Tarek', 'Yara', 'Hadi',
] as const;

type GradeFormClassBackup = {
  gradeFormId: number;
  className: string;
  schoolId: number;
};

type ParentPersonRow = {
  id: number;
  firstName: string;
  lastName: string;
  parent: { id: number } | null;
};

type TeacherPersonRow = {
  id: number;
  teacher: { id: number; personId: number } | null;
};

async function wipeOperationalData(): Promise<GradeFormClassBackup[]> {
  const gradeFormClassBackup = await prisma.$queryRaw<GradeFormClassBackup[]>`
    SELECT gfc.grade_form_id AS "gradeFormId", c.class_name AS "className", gf.school_id AS "schoolId"
    FROM grade_form_class gfc
    JOIN classes c ON c.id = gfc.class_id
    JOIN grade_form gf ON gf.id = gfc.grade_form_id
  `;

  const preservedGradeTypeIds = (
    await prisma.$queryRaw<Array<{ grade_type_id: number }>>`
      SELECT DISTINCT grade_type_id FROM grade_form_detail
    `
  ).map((row) => row.grade_type_id);

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      announcement_sections,
      announcement_targets,
      announcements,
      activities,
      attendance_details,
      attendance,
      attendance_reasons,
      notice_students,
      notice_sections,
      notices,
      notice_types,
      agenda_sections,
      agendas,
      album_images,
      albums,
      exam_schedule_details,
      exam_dates,
      exam_schedules,
      grade_form_class,
      grade_details,
      grades,
      weekly_schedule_details,
      weekly_schedules,
      teach,
      class_courses,
      registrations,
      students,
      parents,
      teacher_schools,
      teachers,
      sections,
      classes,
      stages,
      section_titles,
      courses,
      days,
      sessions,
      password_reset_otps,
      password_change_otps,
      parent_sessions,
      school_details
    RESTART IDENTITY CASCADE
  `);

  await prisma.$executeRawUnsafe(`
    DELETE FROM persons WHERE id <> ${PRESERVED_PERSON_ID}
  `);

  if (preservedGradeTypeIds.length > 0) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM grade_types
      WHERE id NOT IN (${preservedGradeTypeIds.join(',')})
    `);
  } else {
    await prisma.$executeRawUnsafe(`DELETE FROM grade_types`);
  }

  const gradeFormYearIds = (
    await prisma.$queryRaw<Array<{ year_id: number }>>`
      SELECT DISTINCT year_id FROM grade_form
    `
  ).map((row) => row.year_id);

  if (gradeFormYearIds.length > 0) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM years WHERE id NOT IN (${gradeFormYearIds.join(',')})
    `);
  } else {
    await prisma.$executeRawUnsafe(`DELETE FROM years`);
  }

  return gradeFormClassBackup;
}

async function ensureGradeTypes(schoolId: number): Promise<void> {
  const rows = [
    ['عمل يومي للفصل الأول', 1, false, 'homework'],
    ['اختبار الفصل الأول', 2, false, 'test'],
    ['الامتحان النهائي للفصل الأول', 3, true, 'exam'],
    ['عمل يومي للفصل الثاني', 4, false, 'homework'],
    ['اختبار الفصل الثاني', 5, false, 'test'],
    ['الامتحان النهائي للفصل الثاني', 6, true, 'exam'],
    ['عمل يومي للفصل الثالث', 7, false, 'homework'],
    ['اختبار الفصل الثالث', 8, false, 'test'],
    ['الامتحان النهائي للفصل الثالث', 9, true, 'exam'],
  ] as const;

  for (const [title, position, isMain, type] of rows) {
    const existing = await prisma.gradeType.findFirst({
      where: { schoolId, title },
      select: { id: true },
    });
    if (!existing) {
      await prisma.gradeType.create({
        data: {
          schoolId,
          title,
          position,
          isMain,
          type,
          isAbstract: false,
          status: true,
        },
      });
    }
  }
}

async function relinkGradeForms(
  schoolId: number,
  yearId: number,
  classByName: Record<string, { id: number }>,
  backup: GradeFormClassBackup[],
): Promise<void> {
  await prisma.gradeForm.updateMany({
    where: { schoolId },
    data: { yearId },
  });

  for (const link of backup) {
    const classRow = classByName[link.className];
    if (!classRow) continue;

    await prisma.gradeFormClass.upsert({
      where: {
        classId_gradeFormId: {
          classId: classRow.id,
          gradeFormId: link.gradeFormId,
        },
      },
      create: {
        classId: classRow.id,
        gradeFormId: link.gradeFormId,
      },
      update: {},
    });
  }
}

async function seedSchool(schoolId: number, gradeFormBackup: GradeFormClassBackup[]) {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    console.log(`  School ${schoolId} not found — skipped`);
    return;
  }

  console.log(`  Seeding ${school.name} (id=${schoolId})...`);

  let year = await prisma.year.findFirst({
    where: { schoolId, title: CURRENT_YEAR_TITLE },
  });
  if (!year) {
    year = await prisma.year.create({
      data: { schoolId, title: CURRENT_YEAR_TITLE, isCurrent: true },
    });
  } else {
    await prisma.year.updateMany({
      where: { schoolId, id: { not: year.id } },
      data: { isCurrent: false },
    });
    year = await prisma.year.update({
      where: { id: year.id },
      data: { isCurrent: true },
    });
  }

  const stageIds: Record<string, number> = {};
  const stageDefs = [
    { title: 'Kindergarten', position: 1 },
    { title: 'Primary', position: 2 },
    { title: 'Intermediate', position: 3 },
    { title: 'Secondary', position: 4 },
  ];
  for (const stage of stageDefs) {
    const row = await prisma.stage.create({
      data: { schoolId, title: stage.title, position: stage.position },
    });
    stageIds[stage.title.toLowerCase()] = row.id;
  }

  const stageKey = (stage: string) => {
    if (stage === 'kindergarten') return stageIds.kindergarten;
    if (stage === 'primary') return stageIds.primary;
    if (stage === 'intermediate') return stageIds.intermediate;
    return stageIds.secondary;
  };

  const createdClasses = await Promise.all(
    STANDARD_CLASSES.map((item, index) =>
      prisma.class.create({
        data: {
          className: item.className,
          stageId: stageKey(item.stage),
          classLevel: item.classLevel,
          position: index + 1,
        },
      }),
    ),
  );
  const classByName = Object.fromEntries(
    createdClasses.map((item) => [item.className, item]),
  );

  const sectionTitleA = await prisma.sectionTitle.create({
    data: { schoolId, title: 'A', status: 1 },
  });
  const sectionTitleB = await prisma.sectionTitle.create({
    data: { schoolId, title: 'B', status: 1 },
  });

  const courses = await Promise.all(
    COURSES.map((course) =>
      prisma.course.create({
        data: {
          schoolId,
          title: course.title,
          status: true,
        },
      }),
    ),
  );

  const days = await Promise.all(
    DAY_NAMES.map((dayName, index) =>
      prisma.day.create({
        data: { schoolId, dayName, position: index + 1 },
      }),
    ),
  );

  const sessions = await Promise.all(
    SESSION_NAMES.map((sessionName, index) =>
      prisma.session.create({
        data: {
          schoolId,
          sessionName,
          position: index + 1,
          status: true,
        },
      }),
    ),
  );

  const gradeSections: GradeSectionSeed[] = [];

  for (const className of GRADE_FORM_CLASS_NAMES) {
    const classRow = classByName[className];
    if (!classRow) continue;

    for (const course of courses) {
      const courseDef = COURSES.find((item) => item.title === course.title);
      await prisma.classCourse.create({
        data: {
          classId: classRow.id,
          courseId: course.id,
          yearId: year.id,
          coefficient: maxGradeForClassCourse(course.title, classRow.classLevel),
          numberOfHours: courseDef?.hours ?? 4,
          calculation: true,
          position: course.id,
          status: true,
          visible: true,
        },
      });
    }

    const sectionA = await prisma.section.create({
      data: {
        schoolId,
        classId: classRow.id,
        sectionTitleId: sectionTitleA.id,
        yearId: year.id,
        status: 1,
      },
    });

    const sectionB = await prisma.section.create({
      data: {
        schoolId,
        classId: classRow.id,
        sectionTitleId: sectionTitleB.id,
        yearId: year.id,
        status: 1,
      },
    });

    gradeSections.push(
      {
        sectionId: sectionA.id,
        classId: classRow.id,
        classLevel: classRow.classLevel,
        sectionCode: 'a',
      },
      {
        sectionId: sectionB.id,
        classId: classRow.id,
        classLevel: classRow.classLevel,
        sectionCode: 'b',
      },
    );
  }

  if (schoolId === 1) {
    await seedSchoolOnePeople({
      schoolId,
      yearId: year.id,
      gradeSections,
      courses,
      days,
      sessions,
    });
  }

  const schoolBackup = gradeFormBackup.filter((item) => item.schoolId === schoolId);
  await relinkGradeForms(
    schoolId,
    year.id,
    classByName,
    schoolBackup,
  );

  await ensureGradeTypes(schoolId);

  await prisma.schoolDetail.upsert({
    where: { schoolId },
    create: {
      schoolId,
      telephone: schoolId === 1 ? '+961 1 234 567' : '+961 1 987 654',
      phone: schoolId === 1 ? '+961 70 123 456' : '+961 71 987 654',
      fax: schoolId === 1 ? '+961 1 234 568' : '+961 1 987 655',
      address:
        schoolId === 1
          ? 'Hamra Street, Beirut, Lebanon'
          : 'Corniche Road, Beirut, Lebanon',
      email: schoolId === 1 ? 'info@greenvalley.edu' : 'info@bluehorizon.edu',
      website:
        schoolId === 1 ? 'https://greenvalley.edu' : 'https://bluehorizon.edu',
      about:
        schoolId === 1
          ? 'Green Valley School provides quality education from kindergarten through secondary.'
          : 'Blue Horizon Academy focuses on academic excellence and student development.',
    },
    update: {},
  });
}

async function seedSchoolOnePeople({
  schoolId,
  yearId,
  gradeSections,
  courses,
  days,
  sessions,
}: {
  schoolId: number;
  yearId: number;
  gradeSections: GradeSectionSeed[];
  courses: Array<{ id: number; title: string }>;
  days: Array<{ id: number }>;
  sessions: Array<{ id: number }>;
}) {
  const parentRows: ParentPersonRow[] = [];
  for (const parent of PARENTS) {
    const person = await prisma.person.create({
      data: {
        schoolId: parent.global ? null : schoolId,
        username: parent.username,
        password: DEFAULT_PASSWORD,
        firstName: parent.firstName,
        middleName: parent.middleName,
        lastName: parent.lastName,
        email: parent.email,
        phoneNumber: parent.phone,
        status: true,
        address: 'Beirut, Lebanon',
        gender: parent.firstName === 'Maya' ? 1 : 0,
        parent: { create: {} },
      },
      include: { parent: true },
    });
    parentRows.push({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      parent: person.parent,
    });
  }

  const teacherRows: TeacherPersonRow[] = [];
  for (const teacher of TEACHERS) {
    const person = await prisma.person.create({
      data: {
        schoolId,
        username: teacher.username,
        password: DEFAULT_PASSWORD,
        firstName: teacher.firstName,
        middleName: teacher.middleName,
        lastName: teacher.lastName,
        email: teacher.email,
        status: true,
        address: 'Beirut, Lebanon',
        gender: teacher.gender,
        teacher: { create: {} },
      },
      include: { teacher: true },
    });
    await prisma.teacherSchool.create({
      data: {
        teacherId: person.teacher!.id,
        schoolId,
        isActive: true,
      },
    });
    teacherRows.push({
      id: person.id,
      teacher: person.teacher,
    });
  }

  let studentIndex = 0;
  for (const section of gradeSections) {
    for (let i = 1; i <= 10; i += 1) {
      const firstName = STUDENT_FIRST_NAMES[(studentIndex + i - 1) % STUDENT_FIRST_NAMES.length];
      const username = `g${String(section.classLevel).padStart(2, '0')}-${section.sectionCode}-stu-${String(i).padStart(2, '0')}`;
      const parent = parentRows[(studentIndex + i) % parentRows.length];

      const person = await prisma.person.create({
        data: {
          schoolId,
          username,
          password: DEFAULT_PASSWORD,
          firstName,
          middleName: parent.firstName,
          lastName: parent.lastName,
          email: `${username}@student.greenvalley.edu`,
          status: true,
          gender: i % 2 === 0 ? 1 : 0,
          birthday: new Date(2010 + section.classLevel, (i % 12) + 1, 10),
          address: 'Beirut, Lebanon',
          student: {
            create: {
              parentId: parent.parent!.id,
              motherName: 'Maya',
              motherFamily: 'Hassan',
              motherPhone: '+96170333444',
            },
          },
        },
        include: { student: true },
      });

      await prisma.registration.create({
        data: {
          schoolId,
          sectionId: section.sectionId,
          studentId: person.student!.id,
          personId: PRESERVED_PERSON_ID,
          status: true,
        },
      });
    }
    studentIndex += 10;
  }

  let teacherCursor = 0;
  for (const section of gradeSections) {
    for (let c = 0; c < courses.length; c += 1) {
      const teacher = teacherRows[teacherCursor % teacherRows.length];
      teacherCursor += 1;

      await prisma.teach.create({
        data: {
          teacherId: teacher.teacher!.id,
          sectionId: section.sectionId,
          courseId: courses[c].id,
          yearId,
        },
      });
    }

    const scheduledHours = await seedWeeklyScheduleForSection(
      section,
      yearId,
      schoolId,
      days,
      sessions,
    );

    if (scheduledHours > MAX_WEEKLY_HOURS) {
      throw new Error(
        `Section ${section.sectionId} exceeds ${MAX_WEEKLY_HOURS} weekly hours (${scheduledHours})`,
      );
    }
  }
}

async function main(): Promise<void> {
  const preservedPerson = await prisma.person.findUnique({
    where: { id: PRESERVED_PERSON_ID },
  });
  if (!preservedPerson) {
    throw new Error(`Person id=${PRESERVED_PERSON_ID} must exist before reseed`);
  }

  const schools = await prisma.school.findMany({ orderBy: { id: 'asc' } });
  if (schools.length === 0) {
    throw new Error('No schools found — nothing to preserve');
  }

  console.log('Backing up grade form class links and wiping operational data...');
  const gradeFormBackup = await wipeOperationalData();

  console.log('Refreshing lookup tables...');
  await seedLookups(prisma);

  for (const school of schools) {
    await seedSchool(school.id, gradeFormBackup);
  }

  console.log('Done.');
  console.log(`  Preserved person id: ${PRESERVED_PERSON_ID}`);
  console.log(`  Preserved schools: ${schools.map((s) => s.id).join(', ')}`);
  console.log('  Preserved: grade_form, grade_form_detail, grade_form_percentage');
  console.log(`  Year: ${CURRENT_YEAR_TITLE}`);
  console.log(`  Weekly hours cap: ${MAX_WEEKLY_HOURS} per section`);
  console.log('  Sections A & B: teach + schedule for Grade 1–10 (school 1)');
  console.log('  Students: 10 per section A and B (200 total for school 1)');
  console.log('  Password for new accounts: password123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.disconnect();
  });

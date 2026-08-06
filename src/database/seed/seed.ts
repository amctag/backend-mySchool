import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** bcrypt hash for: password123 */
const DEFAULT_PASSWORD =
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
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
      years,
      section_titles,
      courses,
      days,
      sessions,
      persons,
      school
    RESTART IDENTITY CASCADE
  `);
}

async function seedSchoolAcademic(schoolId: number, schoolKey: 'a' | 'b') {
  const year = await prisma.year.create({
    data: {
      schoolId,
      title: '2025-2026',
      isCurrent: true,
    },
  });

  const primaryStage = await prisma.stage.create({
    data: { schoolId, title: 'Primary', position: 1 },
  });

  const middleStage = await prisma.stage.create({
    data: { schoolId, title: 'Middle', position: 2 },
  });

  const class4 = await prisma.class.create({
    data: {
      className: schoolKey === 'a' ? '4A' : '4B',
      stageId: primaryStage.id,
      classLevel: 4,
      position: 1,
    },
  });

  const class5 = await prisma.class.create({
    data: {
      className: schoolKey === 'a' ? '5A' : '5B',
      stageId: middleStage.id,
      classLevel: 5,
      position: 2,
    },
  });

  const sectionTitleA = await prisma.sectionTitle.create({
    data: { schoolId, title: 'Section A', status: 1 },
  });

  const sectionTitleB = await prisma.sectionTitle.create({
    data: { schoolId, title: 'Section B', status: 1 },
  });

  const section4A = await prisma.section.create({
    data: {
      schoolId,
      classId: class4.id,
      sectionTitleId: sectionTitleA.id,
      yearId: year.id,
      status: 1,
    },
  });

  const section5B = await prisma.section.create({
    data: {
      schoolId,
      classId: class5.id,
      sectionTitleId: sectionTitleB.id,
      yearId: year.id,
      status: 1,
    },
  });

  const math = await prisma.course.create({
    data: {
      schoolId,
      title: 'Mathematics',
      description: 'Core math curriculum',
      status: true,
    },
  });

  const english = await prisma.course.create({
    data: {
      schoolId,
      title: 'English',
      description: 'Language and literature',
      status: true,
    },
  });

  const grammar = await prisma.course.create({
    data: {
      schoolId,
      title: 'Grammar',
      description: 'English grammar',
      parentId: english.id,
      status: true,
    },
  });

  await prisma.classCourse.createMany({
    data: [
      {
        classId: class4.id,
        courseId: math.id,
        yearId: year.id,
        numberOfHours: 5,
        position: 1,
      },
      {
        classId: class4.id,
        courseId: english.id,
        yearId: year.id,
        numberOfHours: 4,
        position: 2,
      },
      {
        classId: class5.id,
        courseId: math.id,
        yearId: year.id,
        numberOfHours: 5,
        position: 1,
      },
    ],
  });

  const days = await Promise.all(
    [
      { dayName: 'Monday', position: 1 },
      { dayName: 'Tuesday', position: 2 },
      { dayName: 'Wednesday', position: 3 },
      { dayName: 'Thursday', position: 4 },
      { dayName: 'Friday', position: 5 },
    ].map((day) =>
      prisma.day.create({
        data: { schoolId, ...day },
      }),
    ),
  );

  const sessions = await Promise.all(
    [
      { sessionName: '1st Period', position: 1 },
      { sessionName: '2nd Period', position: 2 },
      { sessionName: '3rd Period', position: 3 },
    ].map((session) =>
      prisma.session.create({
        data: { schoolId, ...session, status: true },
      }),
    ),
  );

  const weeklySchedule = await prisma.weeklySchedule.create({
    data: { sectionId: section4A.id },
  });

  return {
    year,
    section4A,
    section5B,
    math,
    english,
    grammar,
    days,
    sessions,
    weeklySchedule,
  };
}

async function main(): Promise<void> {
  const skipIfSeeded = process.env.SEED_SKIP_IF_EXISTS === 'true';
  const existingSchools = await prisma.school.count();

  if (skipIfSeeded && existingSchools > 0) {
    console.log('Seed skipped: schools already exist (SEED_SKIP_IF_EXISTS=true).');
    return;
  }

  console.log('Resetting database...');
  await resetDatabase();

  console.log('Creating schools...');
  const schoolA = await prisma.school.create({
    data: { name: 'Green Valley School', isActive: true },
  });

  const schoolB = await prisma.school.create({
    data: { name: 'Blue Horizon Academy', isActive: true },
  });

  const academicA = await seedSchoolAcademic(schoolA.id, 'a');
  const academicB = await seedSchoolAcademic(schoolB.id, 'b');

  console.log('Creating global parent (children in both schools)...');
  const parentPerson = await prisma.person.create({
    data: {
      schoolId: null,
      username: 'ahmad.khalil',
      password: DEFAULT_PASSWORD,
      firstName: 'Ahmad',
      middleName: 'Hassan',
      lastName: 'Khalil',
      email: 'ahmad.khalil@example.com',
      phoneNumber: '+96170000001',
      gender: 0,
      status: true,
      parent: { create: {} },
    },
    include: { parent: true },
  });

  const adminA = await prisma.person.create({
    data: {
      schoolId: schoolA.id,
      username: 'admin.green',
      password: DEFAULT_PASSWORD,
      firstName: 'Rania',
      middleName: 'Fadi',
      lastName: 'Admin',
      email: 'admin@greenvalley.edu',
      status: true,
    },
  });

  const adminB = await prisma.person.create({
    data: {
      schoolId: schoolB.id,
      username: 'admin.blue',
      password: DEFAULT_PASSWORD,
      firstName: 'Karim',
      middleName: 'Nabil',
      lastName: 'Admin',
      email: 'admin@bluehorizon.edu',
      status: true,
    },
  });

  console.log('Creating students in different schools for same parent...');
  const studentLaylaPerson = await prisma.person.create({
    data: {
      schoolId: schoolA.id,
      registerId: 1001,
      username: 'layla.khalil',
      password: DEFAULT_PASSWORD,
      firstName: 'Layla',
      middleName: 'Ahmad',
      lastName: 'Khalil',
      email: 'layla.khalil@example.com',
      gender: 1,
      status: true,
      student: {
        create: {
          parentId: parentPerson.parent!.id,
          motherName: 'Maya',
          motherFamily: 'Hassan',
          motherPhone: '+96170000002',
        },
      },
    },
    include: { student: true },
  });

  const studentOmarPerson = await prisma.person.create({
    data: {
      schoolId: schoolB.id,
      registerId: 2001,
      username: 'omar.khalil',
      password: DEFAULT_PASSWORD,
      firstName: 'Omar',
      middleName: 'Ahmad',
      lastName: 'Khalil',
      email: 'omar.khalil@example.com',
      gender: 0,
      status: true,
      student: {
        create: {
          parentId: parentPerson.parent!.id,
          motherName: 'Maya',
          motherFamily: 'Hassan',
          motherPhone: '+96170000002',
        },
      },
    },
    include: { student: true },
  });

  await prisma.registration.createMany({
    data: [
      {
        sectionId: academicA.section4A.id,
        studentId: studentLaylaPerson.student!.id,
        personId: adminA.id,
        status: true,
      },
      {
        sectionId: academicB.section4A.id,
        studentId: studentOmarPerson.student!.id,
        personId: adminB.id,
        status: true,
      },
    ],
  });

  console.log('Creating global teacher (teaches in both schools)...');
  const teacherPerson = await prisma.person.create({
    data: {
      schoolId: null,
      username: 'sara.nasser',
      password: DEFAULT_PASSWORD,
      firstName: 'Sara',
      middleName: 'Ali',
      lastName: 'Nasser',
      email: 'sara.nasser@example.com',
      phoneNumber: '+96170000003',
      gender: 1,
      status: true,
      teacher: { create: {} },
    },
    include: { teacher: true },
  });

  await prisma.teacherSchool.createMany({
    data: [
      { teacherId: teacherPerson.teacher!.id, schoolId: schoolA.id, isActive: true },
      { teacherId: teacherPerson.teacher!.id, schoolId: schoolB.id, isActive: true },
    ],
  });

  await prisma.teach.createMany({
    data: [
      {
        teacherId: teacherPerson.teacher!.id,
        sectionId: academicA.section4A.id,
        courseId: academicA.math.id,
        yearId: academicA.year.id,
      },
      {
        teacherId: teacherPerson.teacher!.id,
        sectionId: academicA.section4A.id,
        courseId: academicA.english.id,
        yearId: academicA.year.id,
      },
      {
        teacherId: teacherPerson.teacher!.id,
        sectionId: academicB.section4A.id,
        courseId: academicB.math.id,
        yearId: academicB.year.id,
      },
    ],
  });

  await prisma.weeklyScheduleDetail.createMany({
    data: [
      {
        scheduleId: academicA.weeklySchedule.id,
        dayId: academicA.days[0].id,
        sessionId: academicA.sessions[0].id,
        courseId: academicA.math.id,
        personId: teacherPerson.id,
      },
      {
        scheduleId: academicA.weeklySchedule.id,
        dayId: academicA.days[1].id,
        sessionId: academicA.sessions[1].id,
        courseId: academicA.english.id,
        personId: teacherPerson.id,
      },
    ],
  });

  console.log('Seed completed successfully.');
  console.log('');
  console.log('Schools:');
  console.log(`  - ${schoolA.name} (id: ${schoolA.id})`);
  console.log(`  - ${schoolB.name} (id: ${schoolB.id})`);
  console.log('');
  console.log('Test accounts (password: password123):');
  console.log('  Parent (global):  ahmad.khalil');
  console.log('  Student school A: layla.khalil');
  console.log('  Student school B: omar.khalil');
  console.log('  Teacher (global): sara.nasser');
  console.log('  Admin school A:   admin.green');
  console.log('  Admin school B:   admin.blue');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** All seeded accounts use this password */
const DEFAULT_PASSWORD = bcrypt.hashSync('password123', 10);

const baseProfile = {
  password: DEFAULT_PASSWORD,
  status: true,
  address: 'Beirut, Lebanon',
  birthday: new Date('1985-03-15'),
  identityNumber: 'LB-12345678',
};

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

  console.log('Creating global parent (school_id = NULL, children in both schools)...');
  const parentPerson = await prisma.person.create({
    data: {
      ...baseProfile,
      schoolId: null, // global: not tied to one school — can have kids in school A and B
      username: 'ahmad.khalil',
      firstName: 'Ahmad',
      middleName: 'Hassan',
      lastName: 'Khalil',
      email: 'ahmad.khalil@example.com',
      phoneNumber: '+96170000001',
      gender: 0,
      parent: { create: {} },
    },
    include: { parent: true },
  });

  console.log('Creating school-only parent (school_id = school A, one child in same school)...');
  const schoolParentPerson = await prisma.person.create({
    data: {
      ...baseProfile,
      schoolId: schoolA.id, // tied to one school — username unique within that school
      username: 'maya.hassan',
      firstName: 'Maya',
      middleName: 'Joseph',
      lastName: 'Hassan',
      email: 'maya.hassan@example.com',
      phoneNumber: '+96170000004',
      gender: 1,
      parent: { create: {} },
    },
    include: { parent: true },
  });

  const adminA = await prisma.person.create({
    data: {
      ...baseProfile,
      schoolId: schoolA.id,
      username: 'admin.green',
      firstName: 'Rania',
      middleName: 'Fadi',
      lastName: 'Admin',
      email: 'admin@greenvalley.edu',
    },
  });

  const adminB = await prisma.person.create({
    data: {
      ...baseProfile,
      schoolId: schoolB.id,
      username: 'admin.blue',
      firstName: 'Karim',
      middleName: 'Nabil',
      lastName: 'Admin',
      email: 'admin@bluehorizon.edu',
    },
  });

  console.log('Creating students (each student person HAS school_id)...');
  const studentLaylaPerson = await prisma.person.create({
    data: {
      ...baseProfile,
      schoolId: schoolA.id, // student always belongs to one school
      registerId: 1001,
      username: 'layla.khalil',
      firstName: 'Layla',
      middleName: 'Ahmad',
      lastName: 'Khalil',
      email: 'layla.khalil@example.com',
      gender: 1,
      birthday: new Date('2015-09-01'),
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
      ...baseProfile,
      schoolId: schoolB.id,
      registerId: 2001,
      username: 'omar.khalil',
      firstName: 'Omar',
      middleName: 'Ahmad',
      lastName: 'Khalil',
      email: 'omar.khalil@example.com',
      gender: 0,
      birthday: new Date('2014-06-20'),
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

  const studentRanaPerson = await prisma.person.create({
    data: {
      ...baseProfile,
      schoolId: schoolA.id,
      registerId: 1002,
      username: 'rana.hassan',
      firstName: 'Rana',
      middleName: 'Maya',
      lastName: 'Hassan',
      email: 'rana.hassan@example.com',
      gender: 1,
      birthday: new Date('2016-01-10'),
      student: {
        create: {
          parentId: schoolParentPerson.parent!.id,
          motherName: 'Maya',
          motherFamily: 'Joseph',
          motherPhone: '+96170000004',
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
      {
        sectionId: academicA.section5B.id,
        studentId: studentRanaPerson.student!.id,
        personId: adminA.id,
        status: true,
      },
    ],
  });

  console.log('Creating global teacher (school_id = NULL, works in both schools)...');
  const teacherPerson = await prisma.person.create({
    data: {
      ...baseProfile,
      schoolId: null,
      username: 'sara.nasser',
      firstName: 'Sara',
      middleName: 'Ali',
      lastName: 'Nasser',
      email: 'sara.nasser@example.com',
      phoneNumber: '+96170000003',
      gender: 1,
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
  console.log('');
  console.log('Person logic:');
  console.log('  persons     = login + profile (name, email, password)');
  console.log('  parents     = role row linked to persons.id');
  console.log('  students    = role row linked to persons.id + parent_id');
  console.log('  school_id   = NULL for global parent/teacher (multi-school)');
  console.log('              = SET for student/admin (belongs to one school)');
  console.log('');
  console.log('  Global parent (school_id NULL):  ahmad.khalil → layla + omar');
  console.log('  School parent (school_id = A):   maya.hassan  → rana');
  console.log('  Student school A: layla.khalil, rana.hassan');
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

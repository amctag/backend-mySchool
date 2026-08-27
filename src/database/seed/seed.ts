import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { seedLookups } from './seed-lookups';
import { SeedPrismaClient } from './seed-prisma.client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const prisma = new SeedPrismaClient(connectionString);

/** All seeded accounts use this password */
const DEFAULT_PASSWORD = bcrypt.hashSync('password123', 10);

const SCHOOL_LOGINS = [
  {
    name: 'Green Valley School',
    email: 'school@greenvalley.edu',
  },
  {
    name: 'Blue Horizon Academy',
    email: 'school@bluehorizon.edu',
  },
] as const;

const baseProfile = {
  password: DEFAULT_PASSWORD,
  status: true,
  address: 'Beirut, Lebanon',
  birthday: new Date('1985-03-15'),
};

async function resetDatabase(): Promise<void> {
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
      grade_form_percentage,
      grade_form_detail,
      grade_form_class,
      grade_form,
      grade_details,
      grades,
      grade_types,
      password_reset_otps,
      password_change_otps,
      school_details,
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
      regions,
      governorates,
      nationalities,
      blood_types,
      parent_jobs,
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

async function syncSchoolLogins(): Promise<void> {
  for (const login of SCHOOL_LOGINS) {
    const school = await prisma.school.findFirst({
      where: { name: login.name },
    });

    if (!school) {
      continue;
    }

    await prisma.school.update({
      where: { id: school.id },
      data: {
        email: login.email,
        password: DEFAULT_PASSWORD,
      },
    });

    console.log(`  ${school.name}: ${login.email} / password123`);
  }
}

async function main(): Promise<void> {
  const forceReseed = process.env.SEED_FORCE === 'true';
  const existingSchools = await prisma.school.count();

  if (existingSchools > 0 && !forceReseed) {
    console.log(
      'Database already has data — updating school logins and lookup tables...',
    );
    await syncSchoolLogins();
    await seedLookups(prisma);
    console.log(
      'Person/parent/student seed skipped. Set SEED_FORCE=true only on a dev/test DB to wipe and re-seed.',
    );
    return;
  }

  if (forceReseed) {
    console.log('SEED_FORCE=true — resetting database before seed...');
  } else {
    console.log('Empty database — running initial seed...');
  }

  console.log('Resetting database...');
  await resetDatabase();

  console.log('Creating schools...');
  const schoolA = await prisma.school.create({
    data: {
      name: SCHOOL_LOGINS[0].name,
      email: SCHOOL_LOGINS[0].email,
      password: DEFAULT_PASSWORD,
      isActive: true,
    },
  });

  const schoolB = await prisma.school.create({
    data: {
      name: SCHOOL_LOGINS[1].name,
      email: SCHOOL_LOGINS[1].email,
      password: DEFAULT_PASSWORD,
      isActive: true,
    },
  });

  console.log('Creating school details...');
  await prisma.schoolDetail.createMany({
    data: [
      {
        schoolId: schoolA.id,
        telephone: '+961 1 234 567',
        phone: '+961 70 123 456',
        fax: '+961 1 234 568',
        address: 'Hamra Street, Beirut, Lebanon',
        email: 'info@greenvalley.edu',
        website: 'https://greenvalley.edu',
        about:
          'Green Valley School provides quality education from primary through middle school.',
      },
      {
        schoolId: schoolB.id,
        telephone: '+961 1 987 654',
        phone: '+961 71 987 654',
        fax: '+961 1 987 655',
        address: 'Corniche Road, Beirut, Lebanon',
        email: 'info@bluehorizon.edu',
        website: 'https://bluehorizon.edu',
        about:
          'Blue Horizon Academy focuses on academic excellence and student development.',
      },
    ],
  });

  console.log('Creating lookup tables...');
  await seedLookups(prisma);

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
      identityNumber: 'LB-10000001',
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
      identityNumber: 'LB-10000002',
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
      identityNumber: 'LB-10000003',
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
      identityNumber: 'LB-10000004',
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
      identityNumber: 'LB-10000005',
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
      identityNumber: 'LB-10000006',
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
      identityNumber: 'LB-10000007',
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
      identityNumber: 'LB-10000008',
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

  console.log('Creating announcements...');
  const publishNow = new Date();

  await prisma.announcement.create({
    data: {
      title: 'Welcome Back to School',
      content: 'We are excited to welcome all parents and students to the new term.',
      personId: adminA.id,
      publishDate: publishNow,
      publishTime: publishNow,
      targets: {
        create: { audienceTarget: 'parent' },
      },
    },
  });

  await prisma.announcement.create({
    data: {
      title: 'Class 4A Parent Meeting',
      content: 'Parents of Class 4 Section A are invited to a meeting this Thursday at 4 PM.',
      personId: adminA.id,
      publishDate: publishNow,
      publishTime: publishNow,
      targets: {
        create: { audienceTarget: 'parent' },
      },
      sections: {
        create: {
          sectionId: academicA.section4A.id,
          classId: academicA.section4A.classId,
        },
      },
    },
  });

  await prisma.announcement.create({
    data: {
      title: 'Blue Horizon Sports Day',
      content: 'Sports day for Class 4 students will be held next Monday.',
      personId: adminB.id,
      publishDate: publishNow,
      publishTime: publishNow,
      targets: {
        create: { audienceTarget: 'parent' },
      },
      sections: {
        create: {
          sectionId: academicB.section4A.id,
          classId: academicB.section4A.classId,
        },
      },
    },
  });

  console.log('Creating activities...');
  const activityDate = new Date('2026-03-15');

  await prisma.activity.create({
    data: {
      title: 'National Reading Week',
      content: 'Celebrate reading with activities across all participating schools.',
      date: activityDate,
      image: 'https://cdn.example.com/activities/reading-week.jpg',
      personId: teacherPerson.id,
    },
  });

  await prisma.activity.create({
    data: {
      title: 'Green Valley Sports Day',
      content: 'Students will compete in track, football, and relay events.',
      date: new Date('2026-04-20'),
      image: 'https://cdn.example.com/activities/green-sports-day.jpg',
      personId: adminA.id,
      yearId: academicA.year.id,
    },
  });

  await prisma.activity.create({
    data: {
      title: 'Blue Horizon Art Exhibition',
      content: 'Student artwork will be displayed in the main hall.',
      date: new Date('2026-05-10'),
      image: 'https://cdn.example.com/activities/blue-art-exhibition.jpg',
      personId: adminB.id,
      yearId: academicB.year.id,
    },
  });

  console.log('Creating attendance absences...');
  const sickReason = await prisma.attendanceReason.create({
    data: {
      title: 'Sick',
      personId: adminA.id,
    },
  });

  const familyReason = await prisma.attendanceReason.create({
    data: {
      title: 'Family reason',
      personId: adminB.id,
    },
  });

  await prisma.attendance.create({
    data: {
      date: new Date('2026-08-03'),
      sectionId: academicA.section4A.id,
      personId: adminA.id,
      details: {
        create: {
          studentId: studentLaylaPerson.student!.id,
          status: 'absent',
          attendanceReasonId: sickReason.id,
          description: 'Fever',
        },
      },
    },
  });

  await prisma.attendance.create({
    data: {
      date: new Date('2026-08-07'),
      sectionId: academicA.section4A.id,
      personId: adminA.id,
      details: {
        create: {
          studentId: studentLaylaPerson.student!.id,
          status: 'absent',
          attendanceReasonId: sickReason.id,
        },
      },
    },
  });

  await prisma.attendance.create({
    data: {
      date: new Date('2026-08-05'),
      sectionId: academicB.section4A.id,
      personId: adminB.id,
      details: {
        create: {
          studentId: studentOmarPerson.student!.id,
          status: 'absent',
          attendanceReasonId: familyReason.id,
          description: 'Travel with family',
        },
      },
    },
  });

  await prisma.attendance.create({
    data: {
      date: new Date('2026-08-04'),
      sectionId: academicA.section4A.id,
      personId: adminA.id,
      details: {
        create: {
          studentId: studentLaylaPerson.student!.id,
          status: 'present',
        },
      },
    },
  });

  console.log('Creating notices...');
  await prisma.noticeType.create({
    data: {
      title: 'Behavior',
      personId: adminA.id,
    },
  });

  await prisma.noticeType.create({
    data: {
      title: 'Behavior',
      personId: adminB.id,
    },
  });

  await prisma.notice.create({
    data: {
      schoolId: schoolA.id,
      description: 'Please submit the medical form by Friday.',
      personId: adminA.id,
      date: new Date('2026-08-10'),
      sections: {
        create: {
          sectionId: academicA.section4A.id,
        },
      },
    },
  });

  await prisma.notice.create({
    data: {
      schoolId: schoolA.id,
      description: 'Reminder: science project is due next week.',
      personId: adminA.id,
      date: new Date('2026-08-08'),
      students: {
        create: {
          studentId: studentLaylaPerson.student!.id,
        },
      },
    },
  });

  await prisma.notice.create({
    data: {
      schoolId: schoolB.id,
      description: 'Library books must be returned before the end of the month.',
      personId: adminB.id,
      date: new Date('2026-08-09'),
      sections: {
        create: {
          sectionId: academicB.section4A.id,
        },
      },
    },
  });

  await prisma.notice.create({
    data: {
      schoolId: schoolB.id,
      description: 'Please bring your PE uniform on Monday.',
      personId: adminB.id,
      date: new Date('2026-08-07'),
      students: {
        create: {
          studentId: studentOmarPerson.student!.id,
        },
      },
    },
  });

  await prisma.notice.create({
    data: {
      schoolId: schoolA.id,
      description: 'Individual follow-up required for recent homework submissions.',
      personId: adminA.id,
      date: new Date('2026-08-11'),
      students: {
        create: {
          studentId: studentRanaPerson.student!.id,
        },
      },
    },
  });

  console.log('Creating agendas...');

  await prisma.agenda.create({
    data: {
      description: 'Complete exercises 1–10 on page 42.',
      agendaDate: new Date('2026-08-10'),
      time: '09:00',
      personId: adminA.id,
      courseId: academicA.math.id,
      imageLink: 'https://cdn.example.com/agendas/math-homework.jpg',
      fileLink: 'https://cdn.example.com/agendas/math-worksheet.pdf',
      publishedDate: new Date('2026-08-05T08:00:00.000Z'),
      createdAt: new Date('2026-08-01T09:00:00.000Z'),
      status: 1,
      sections: {
        create: { sectionId: academicA.section4A.id },
      },
    },
  });

  await prisma.agenda.create({
    data: {
      description: 'Read chapter 3 and prepare a short summary.',
      agendaDate: new Date('2026-08-12'),
      time: '10:30',
      personId: adminA.id,
      courseId: academicA.english.id,
      imageLink: 'https://cdn.example.com/agendas/english-reading.jpg',
      fileLink: 'https://cdn.example.com/agendas/english-summary.pdf',
      publishedDate: new Date('2026-08-05T08:00:00.000Z'),
      createdAt: new Date('2026-08-01T09:00:00.000Z'),
      status: 1,
      sections: {
        create: { sectionId: academicA.section4A.id },
      },
    },
  });

  await prisma.agenda.create({
    data: {
      description: 'Review multiplication tables for the quiz.',
      agendaDate: new Date('2026-08-08'),
      time: '08:45',
      personId: adminB.id,
      courseId: academicB.math.id,
      imageLink: 'https://cdn.example.com/agendas/math-quiz.jpg',
      fileLink: 'https://cdn.example.com/agendas/math-quiz-guide.pdf',
      publishedDate: new Date('2026-08-05T08:00:00.000Z'),
      createdAt: new Date('2026-08-01T09:00:00.000Z'),
      status: 1,
      sections: {
        create: { sectionId: academicB.section4A.id },
      },
    },
  });

  console.log('Creating albums...');

  await prisma.album.create({
    data: {
      schoolId: schoolA.id,
      yearId: academicA.year.id,
      title: 'Sports Day 2026',
      description: 'Photos from the annual sports day at Green Valley School.',
      date: new Date('2026-03-15'),
      status: 1,
      images: {
        create: [
          {
            imageLink: 'https://cdn.example.com/albums/green-sports-1.jpg',
            caption: 'Opening ceremony',
            position: 1,
          },
          {
            imageLink: 'https://cdn.example.com/albums/green-sports-2.jpg',
            caption: 'Relay race',
            position: 2,
          },
          {
            imageLink: 'https://cdn.example.com/albums/green-sports-3.jpg',
            caption: 'Award ceremony',
            position: 3,
          },
        ],
      },
    },
  });

  await prisma.album.create({
    data: {
      schoolId: schoolA.id,
      yearId: academicA.year.id,
      title: 'Science Fair 2026',
      description: 'Student projects and experiments from the science fair.',
      date: new Date('2026-04-20'),
      status: 1,
      images: {
        create: [
          {
            imageLink: 'https://cdn.example.com/albums/green-science-1.jpg',
            caption: 'Project displays',
            position: 1,
          },
          {
            imageLink: 'https://cdn.example.com/albums/green-science-2.jpg',
            caption: 'Judges visit',
            position: 2,
          },
        ],
      },
    },
  });

  await prisma.album.create({
    data: {
      schoolId: schoolB.id,
      yearId: academicB.year.id,
      title: 'Art Exhibition 2026',
      description: 'Student artwork displayed at Blue Horizon Academy.',
      date: new Date('2026-05-10'),
      status: 1,
      images: {
        create: [
          {
            imageLink: 'https://cdn.example.com/albums/blue-art-1.jpg',
            caption: 'Main hall display',
            position: 1,
          },
          {
            imageLink: 'https://cdn.example.com/albums/blue-art-2.jpg',
            caption: 'Painting section',
            position: 2,
          },
        ],
      },
    },
  });

  console.log('Creating exam schedules...');

  const midtermType = await prisma.gradeType.create({
    data: {
      title: 'Midterm',
      type: 'exam',
      isMain: true,
      position: 1,
    },
  });

  const finalType = await prisma.gradeType.create({
    data: {
      title: 'Final',
      type: 'exam',
      isMain: true,
      position: 2,
    },
  });

  await prisma.examSchedule.create({
    data: {
      title: 'Midterm Exams 2026',
      classId: academicA.section4A.classId,
      yearId: academicA.year.id,
      gradeTypeId: midtermType.id,
      personId: adminA.id,
      note: 'Please arrive 15 minutes before each exam.',
      dates: {
        create: [
          {
            date: new Date('2026-06-10'),
            details: {
              create: [
                {
                  courseId: academicA.math.id,
                  position: 1,
                  startTime: '09:00',
                  duration: 90,
                },
                {
                  courseId: academicA.english.id,
                  position: 2,
                  startTime: '11:00',
                  duration: 60,
                },
              ],
            },
          },
          {
            date: new Date('2026-06-12'),
            details: {
              create: [
                {
                  courseId: academicA.math.id,
                  position: 1,
                  startTime: '09:00',
                  duration: 90,
                  note: 'Room 204',
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.examSchedule.create({
    data: {
      title: 'Final Exams 2026',
      classId: academicA.section4A.classId,
      yearId: academicA.year.id,
      gradeTypeId: finalType.id,
      personId: adminA.id,
      dates: {
        create: [
          {
            date: new Date('2026-06-20'),
            details: {
              create: [
                {
                  courseId: academicA.math.id,
                  position: 1,
                  startTime: '08:30',
                  duration: 120,
                },
                {
                  courseId: academicA.english.id,
                  position: 2,
                  startTime: '11:00',
                  duration: 90,
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.examSchedule.create({
    data: {
      title: 'Midterm Exams 2026',
      classId: academicB.section4A.classId,
      yearId: academicB.year.id,
      gradeTypeId: midtermType.id,
      personId: adminB.id,
      note: 'Bring your student ID card.',
      dates: {
        create: [
          {
            date: new Date('2026-06-11'),
            details: {
              create: [
                {
                  courseId: academicB.math.id,
                  position: 1,
                  startTime: '10:00',
                  duration: 90,
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log('Creating grades...');

  const laylaRegistration = await prisma.registration.findFirst({
    where: { studentId: studentLaylaPerson.student!.id, status: true },
  });
  const omarRegistration = await prisma.registration.findFirst({
    where: { studentId: studentOmarPerson.student!.id, status: true },
  });
  const ranaRegistration = await prisma.registration.findFirst({
    where: { studentId: studentRanaPerson.student!.id, status: true },
  });

  const publishedAt = new Date('2026-06-15T08:00:00.000Z');

  if (laylaRegistration) {
    await prisma.grade.create({
      data: {
        schoolId: schoolA.id,
        sectionId: academicA.section4A.id,
        courseId: academicA.math.id,
        gradeTypeId: midtermType.id,
        maxGrade: 100,
        publishDate: publishedAt,
        personId: adminA.id,
        details: {
          create: {
            registrationId: laylaRegistration.id,
            grade: 86.5,
            comment: 'Good work',
          },
        },
      },
    });

    await prisma.grade.create({
      data: {
        schoolId: schoolA.id,
        sectionId: academicA.section4A.id,
        courseId: academicA.english.id,
        gradeTypeId: midtermType.id,
        maxGrade: 100,
        publishDate: publishedAt,
        personId: adminA.id,
        details: {
          create: {
            registrationId: laylaRegistration.id,
            grade: 91,
          },
        },
      },
    });
  }

  if (omarRegistration) {
    await prisma.grade.create({
      data: {
        schoolId: schoolB.id,
        sectionId: academicB.section4A.id,
        courseId: academicB.math.id,
        gradeTypeId: midtermType.id,
        maxGrade: 100,
        publishDate: publishedAt,
        personId: adminB.id,
        details: {
          create: {
            registrationId: omarRegistration.id,
            grade: 78,
            comment: 'Needs more practice',
          },
        },
      },
    });
  }

  if (ranaRegistration) {
    await prisma.grade.create({
      data: {
        schoolId: schoolA.id,
        sectionId: academicA.section5B.id,
        courseId: academicA.math.id,
        gradeTypeId: midtermType.id,
        maxGrade: 100,
        publishDate: publishedAt,
        personId: adminA.id,
        details: {
          create: {
            registrationId: ranaRegistration.id,
            grade: 88,
          },
        },
      },
    });
  }

  await prisma.gradeForm.create({
    data: {
      schoolId: schoolA.id,
      title: 'Primary Report Card',
      yearId: academicA.year.id,
      gradeFormatId: 1,
      classes: {
        create: { classId: academicA.section4A.classId },
      },
      details: {
        create: {
          gradeTypeId: midtermType.id,
          position: 1,
          percentages: {
            create: { percentage: 100 },
          },
        },
      },
    },
  });

  console.log('Seed completed successfully.');
  console.log('');
  console.log('Schools:');
  console.log(`  - ${schoolA.name} (id: ${schoolA.id})`);
  console.log(`  - ${schoolB.name} (id: ${schoolB.id})`);
  console.log('');
  console.log('Test accounts (password: password123):');
  console.log('');
  console.log('School dashboard login (school.email):');
  console.log('  Green Valley:  school@greenvalley.edu');
  console.log('  Blue Horizon:  school@bluehorizon.edu');
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
    await prisma.disconnect();
  });

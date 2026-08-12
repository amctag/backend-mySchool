import 'dotenv/config';
import { SeedPrismaClient } from './seed-prisma.client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const prisma = new SeedPrismaClient(connectionString);

const FAKE_SCHOOL_DETAILS = [
  {
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
    telephone: '+961 1 987 654',
    phone: '+961 71 987 654',
    fax: '+961 1 987 655',
    address: 'Corniche Road, Beirut, Lebanon',
    email: 'info@bluehorizon.edu',
    website: 'https://bluehorizon.edu',
    about:
      'Blue Horizon Academy focuses on academic excellence and student development.',
  },
];

const FAKE_ABSENCES: Array<{
  date: string;
  studentUsername: string;
  reasonTitle: string;
  description?: string;
}> = [
  {
    date: '2026-08-03',
    studentUsername: 'layla.khalil',
    reasonTitle: 'Sick',
    description: 'Fever',
  },
  {
    date: '2026-08-07',
    studentUsername: 'layla.khalil',
    reasonTitle: 'Sick',
  },
  {
    date: '2026-08-12',
    studentUsername: 'layla.khalil',
    reasonTitle: 'Sick',
    description: 'Doctor appointment',
  },
  {
    date: '2026-08-05',
    studentUsername: 'omar.khalil',
    reasonTitle: 'Family reason',
    description: 'Travel with family',
  },
  {
    date: '2026-08-14',
    studentUsername: 'omar.khalil',
    reasonTitle: 'Family reason',
  },
  {
    date: '2026-08-08',
    studentUsername: 'rana.hassan',
    reasonTitle: 'Sick',
    description: 'Cold',
  },
];

async function findRecorderForSchool(schoolId: number): Promise<number | null> {
  const admin = await prisma.person.findFirst({
    where: {
      schoolId,
      status: true,
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  return admin?.id ?? null;
}

async function findOrCreateReason(
  title: string,
  personId: number,
): Promise<number> {
  const existing = await prisma.attendanceReason.findFirst({
    where: {
      title,
      personId,
      deletedAt: null,
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.attendanceReason.create({
    data: { title, personId, status: true },
    select: { id: true },
  });

  return created.id;
}

async function seedSchoolDetailsIfMissing(): Promise<void> {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  if (schools.length === 0) {
    console.log('No schools found — skipping school details.');
    return;
  }

  for (const [index, school] of schools.entries()) {
    const template = FAKE_SCHOOL_DETAILS[index] ?? FAKE_SCHOOL_DETAILS[0];

    await prisma.schoolDetail.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        ...template,
      },
      update: {},
    });

    console.log(`  school_details ensured for school id ${school.id} (${school.name})`);
  }
}

async function seedAnnouncementsIfEmpty(): Promise<void> {
  const existingCount = await prisma.announcement.count({
    where: { deletedAt: null },
  });

  if (existingCount > 0) {
    console.log(`  announcements already exist (${existingCount}) — skipped`);
    return;
  }

  const recorder = await prisma.person.findFirst({
    where: { status: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (!recorder) {
    console.log('  no person found — skipped announcements');
    return;
  }

  const publishNow = new Date();

  await prisma.announcement.createMany({
    data: [
      {
        title: 'Welcome Back to School',
        content: 'We are excited to welcome all parents and students to the new term.',
        personId: recorder.id,
        publishDate: publishNow,
        publishTime: publishNow,
      },
      {
        title: 'Parent Meeting Reminder',
        content: 'Please check the schedule for upcoming parent meetings this month.',
        personId: recorder.id,
        publishDate: publishNow,
        publishTime: publishNow,
      },
    ],
  });

  const announcements = await prisma.announcement.findMany({
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  await prisma.announcementTarget.createMany({
    data: announcements.map((announcement) => ({
      announcementId: announcement.id,
      audienceTarget: 'parent' as const,
    })),
  });

  console.log(`  created ${announcements.length} announcements`);
}

async function seedActivitiesIfEmpty(): Promise<void> {
  const existingCount = await prisma.activity.count({
    where: { deletedAt: null },
  });

  if (existingCount > 0) {
    console.log(`  activities already exist (${existingCount}) — skipped`);
    return;
  }

  const recorder = await prisma.person.findFirst({
    where: { status: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (!recorder) {
    console.log('  no person found — skipped activities');
    return;
  }

  await prisma.activity.createMany({
    data: [
      {
        title: 'National Reading Week',
        content: 'Celebrate reading with activities across all participating schools.',
        date: new Date('2026-03-15'),
        image: 'https://cdn.example.com/activities/reading-week.jpg',
        personId: recorder.id,
      },
      {
        title: 'Sports Day',
        content: 'Students will compete in track, football, and relay events.',
        date: new Date('2026-04-20'),
        image: 'https://cdn.example.com/activities/sports-day.jpg',
        personId: recorder.id,
      },
      {
        title: 'Art Exhibition',
        content: 'Student artwork will be displayed in the main hall.',
        date: new Date('2026-05-10'),
        image: 'https://cdn.example.com/activities/art-exhibition.jpg',
        personId: recorder.id,
      },
    ],
  });

  console.log('  created 3 activities');
}

async function seedAttendanceAbsences(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const item of FAKE_ABSENCES) {
    const student = await prisma.student.findFirst({
      where: {
        person: { username: item.studentUsername },
      },
      include: {
        person: { select: { schoolId: true } },
        registrations: {
          where: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { section: { select: { id: true, schoolId: true } } },
        },
      },
    });

    const section = student?.registrations[0]?.section;

    if (!student || !section) {
      console.log(`  skipped absence ${item.date} — student ${item.studentUsername} not found`);
      skipped += 1;
      continue;
    }

    const recorderId = await findRecorderForSchool(section.schoolId);

    if (!recorderId) {
      console.log(`  skipped absence ${item.date} — no recorder for school ${section.schoolId}`);
      skipped += 1;
      continue;
    }

    const reasonId = await findOrCreateReason(item.reasonTitle, recorderId);
    const absenceDate = new Date(item.date);

    const existing = await prisma.attendanceDetail.findFirst({
      where: {
        studentId: student.id,
        status: 'absent',
        deletedAt: null,
        attendance: {
          date: absenceDate,
          sectionId: section.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.attendance.create({
      data: {
        date: absenceDate,
        sectionId: section.id,
        personId: recorderId,
        details: {
          create: {
            studentId: student.id,
            status: 'absent',
            attendanceReasonId: reasonId,
            description: item.description,
          },
        },
      },
    });

    created += 1;
  }

  console.log(`  attendance absences: ${created} created, ${skipped} skipped`);
}

const FAKE_NOTICES: Array<{
  target: 'section' | 'student';
  studentUsername: string;
  description: string;
  date: string;
}> = [
  {
    target: 'section',
    studentUsername: 'layla.khalil',
    description: 'Please submit the medical form by Friday.',
    date: '2026-08-10',
  },
  {
    target: 'student',
    studentUsername: 'layla.khalil',
    description: 'Reminder: science project is due next week.',
    date: '2026-08-08',
  },
  {
    target: 'section',
    studentUsername: 'omar.khalil',
    description: 'Library books must be returned before the end of the month.',
    date: '2026-08-09',
  },
  {
    target: 'student',
    studentUsername: 'omar.khalil',
    description: 'Please bring your PE uniform on Monday.',
    date: '2026-08-07',
  },
  {
    target: 'student',
    studentUsername: 'rana.hassan',
    description: 'Individual follow-up required for recent homework submissions.',
    date: '2026-08-11',
  },
];

async function findStudentWithActiveSection(username: string) {
  return prisma.student.findFirst({
    where: { person: { username } },
    include: {
      person: { select: { schoolId: true } },
      registrations: {
        where: { status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { section: { select: { id: true, schoolId: true } } },
      },
    },
  });
}

async function findFallbackStudentForSchool(schoolId: number) {
  return prisma.student.findFirst({
    where: {
      person: { schoolId },
      registrations: { some: { status: true } },
    },
    include: {
      person: { select: { schoolId: true, username: true } },
      registrations: {
        where: { status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { section: { select: { id: true, schoolId: true } } },
      },
    },
  });
}

async function seedNoticeTypesIfMissing(): Promise<void> {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });

  let created = 0;

  for (const school of schools) {
    const recorderId = await findRecorderForSchool(school.id);

    if (!recorderId) {
      continue;
    }

    const existing = await prisma.noticeType.findFirst({
      where: {
        title: 'Behavior',
        personId: recorderId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.noticeType.create({
      data: {
        title: 'Behavior',
        personId: recorderId,
      },
    });

    created += 1;
  }

  if (created > 0) {
    console.log(`  notice types: ${created} created`);
  } else {
    console.log('  notice types already exist — skipped');
  }
}

async function resolveStudentForNotice(username: string) {
  const direct = await findStudentWithActiveSection(username);

  if (direct?.registrations[0]?.section) {
    return direct;
  }

  const person = await prisma.person.findFirst({
    where: { username },
    select: { schoolId: true },
  });

  if (!person?.schoolId) {
    return null;
  }

  const fallback = await findFallbackStudentForSchool(person.schoolId);

  if (fallback?.registrations[0]?.section) {
    return fallback;
  }

  return null;
}

async function seedNotices(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const item of FAKE_NOTICES) {
    const student = await resolveStudentForNotice(item.studentUsername);
    const section = student?.registrations[0]?.section;

    if (!student || !section) {
      console.log(
        `  skipped notice "${item.description}" — student ${item.studentUsername} not found`,
      );
      skipped += 1;
      continue;
    }

    const schoolId = section.schoolId;
    const recorderId = await findRecorderForSchool(schoolId);

    if (!recorderId) {
      console.log(
        `  skipped notice "${item.description}" — no recorder for school ${schoolId}`,
      );
      skipped += 1;
      continue;
    }

    const noticeDate = new Date(item.date);

    const existing = await prisma.notice.findFirst({
      where: {
        schoolId,
        description: item.description,
        date: noticeDate,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.notice.create({
      data: {
        schoolId,
        description: item.description,
        personId: recorderId,
        date: noticeDate,
        ...(item.target === 'section'
          ? { sections: { create: { sectionId: section.id } } }
          : { students: { create: { studentId: student.id } } }),
      },
    });

    created += 1;
  }

  console.log(`  notices: ${created} created, ${skipped} skipped`);
}

const FAKE_AGENDAS: Array<{
  studentUsername: string;
  courseTitle: string;
  description: string;
  date: string;
  time: string;
  imageLink: string;
  fileLink: string;
  publishedDate: string;
  createdAt: string;
}> = [
  {
    studentUsername: 'layla.khalil',
    courseTitle: 'Mathematics',
    description: 'Complete exercises 1–10 on page 42.',
    date: '2026-08-10',
    time: '09:00',
    imageLink: 'https://cdn.example.com/agendas/math-homework.jpg',
    fileLink: 'https://cdn.example.com/agendas/math-worksheet.pdf',
    publishedDate: '2026-08-05',
    createdAt: '2026-08-01',
  },
  {
    studentUsername: 'layla.khalil',
    courseTitle: 'English',
    description: 'Read chapter 3 and prepare a short summary.',
    date: '2026-08-12',
    time: '10:30',
    imageLink: 'https://cdn.example.com/agendas/english-reading.jpg',
    fileLink: 'https://cdn.example.com/agendas/english-summary.pdf',
    publishedDate: '2026-08-05',
    createdAt: '2026-08-01',
  },
  {
    studentUsername: 'omar.khalil',
    courseTitle: 'Mathematics',
    description: 'Review multiplication tables for the quiz.',
    date: '2026-08-08',
    time: '08:45',
    imageLink: 'https://cdn.example.com/agendas/math-quiz.jpg',
    fileLink: 'https://cdn.example.com/agendas/math-quiz-guide.pdf',
    publishedDate: '2026-08-05',
    createdAt: '2026-08-01',
  },
];

async function findCourseForSchool(
  schoolId: number,
  title: string,
): Promise<{ id: number } | null> {
  return prisma.course.findFirst({
    where: {
      schoolId,
      title,
      status: true,
    },
    select: { id: true },
  });
}

async function seedAgendas(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const item of FAKE_AGENDAS) {
    const student = await resolveStudentForNotice(item.studentUsername);
    const section = student?.registrations[0]?.section;

    if (!student || !section) {
      console.log(
        `  skipped agenda "${item.description}" — student ${item.studentUsername} not found`,
      );
      skipped += 1;
      continue;
    }

    const recorderId = await findRecorderForSchool(section.schoolId);

    if (!recorderId) {
      console.log(
        `  skipped agenda "${item.description}" — no recorder for school ${section.schoolId}`,
      );
      skipped += 1;
      continue;
    }

    const course = await findCourseForSchool(section.schoolId, item.courseTitle);

    if (!course) {
      console.log(
        `  skipped agenda "${item.description}" — course ${item.courseTitle} not found`,
      );
      skipped += 1;
      continue;
    }

    const agendaDate = new Date(item.date);

    const existing = await prisma.agenda.findFirst({
      where: {
        courseId: course.id,
        description: item.description,
        date: agendaDate,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.agenda.create({
      data: {
        description: item.description,
        date: agendaDate,
        time: item.time,
        personId: recorderId,
        courseId: course.id,
        imageLink: item.imageLink,
        fileLink: item.fileLink,
        publishedDate: new Date(item.publishedDate),
        createdAt: new Date(item.createdAt),
        status: 1,
        sections: { create: { sectionId: section.id } },
      },
    });

    created += 1;
  }

  console.log(`  agendas: ${created} created, ${skipped} skipped`);
}

async function main(): Promise<void> {
  console.log('Adding fake demo data (does NOT delete existing data)...');
  console.log('');

  await seedSchoolDetailsIfMissing();
  await seedAnnouncementsIfEmpty();
  await seedActivitiesIfEmpty();
  await seedAttendanceAbsences();
  await seedNoticeTypesIfMissing();
  await seedNotices();
  await seedAgendas();

  console.log('');
  console.log('Fake data finished.');
  console.log('');
  console.log('Test attendance API (August 2026):');
  console.log('  GET /api/v1/parent/me/attendance/absences?month=2026-08');
  console.log('  GET /api/v1/parent/me/attendance/absences?month=2026-08&studentId=1');
  console.log('');
  console.log('Test notices API:');
  console.log('  GET /api/v1/parent/me/notices');
  console.log('  GET /api/v1/parent/me/notices?studentId=1');
  console.log('  GET /api/v1/parent/me/notices?studentId=1&page=1&limit=10');
  console.log('');
  console.log('Test agendas API:');
  console.log('  GET /api/v1/parent/me/agendas?month=2026-08');
  console.log('  GET /api/v1/parent/me/agendas?month=2026-08&studentId=1');
  console.log('  GET /api/v1/parent/me/agendas?month=2026-08&studentId=1&page=1&limit=10');
  console.log('');
  console.log('Accounts (password: password123):');
  console.log('  ahmad.khalil — global parent → layla + omar notices');
  console.log('  maya.hassan  — school parent → rana notices');
}

main()
  .catch((error: unknown) => {
    console.error('Fake data seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.disconnect();
  });

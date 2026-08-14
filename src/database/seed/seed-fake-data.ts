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
  agendaDate: string;
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
    agendaDate: '2026-08-10',
    time: '09:00',
    imageLink: 'https://cdn.example.com/agendas/math-homework.jpg',
    fileLink: 'https://cdn.example.com/agendas/math-worksheet.pdf',
    publishedDate: '2026-08-05T08:00:00.000Z',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    studentUsername: 'layla.khalil',
    courseTitle: 'English',
    description: 'Read chapter 3 and prepare a short summary.',
    agendaDate: '2026-08-12',
    time: '10:30',
    imageLink: 'https://cdn.example.com/agendas/english-reading.jpg',
    fileLink: 'https://cdn.example.com/agendas/english-summary.pdf',
    publishedDate: '2026-08-05T08:00:00.000Z',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    studentUsername: 'omar.khalil',
    courseTitle: 'Mathematics',
    description: 'Review multiplication tables for the quiz.',
    agendaDate: '2026-08-08',
    time: '08:45',
    imageLink: 'https://cdn.example.com/agendas/math-quiz.jpg',
    fileLink: 'https://cdn.example.com/agendas/math-quiz-guide.pdf',
    publishedDate: '2026-08-05T08:00:00.000Z',
    createdAt: '2026-08-01T09:00:00.000Z',
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

    const agendaDay = new Date(item.agendaDate);

    const existing = await prisma.agenda.findFirst({
      where: {
        courseId: course.id,
        description: item.description,
        agendaDate: agendaDay,
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
        agendaDate: agendaDay,
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

const FAKE_ALBUMS: Array<{
  schoolName: string;
  yearTitle: string;
  title: string;
  description: string;
  date: string;
  images: Array<{ imageLink: string; caption: string; position: number }>;
}> = [
  {
    schoolName: 'Green Valley School',
    yearTitle: '2025-2026',
    title: 'Sports Day 2026',
    description: 'Photos from the annual sports day at Green Valley School.',
    date: '2026-03-15',
    images: [
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
    ],
  },
  {
    schoolName: 'Green Valley School',
    yearTitle: '2025-2026',
    title: 'Science Fair 2026',
    description: 'Student projects and experiments from the science fair.',
    date: '2026-04-20',
    images: [
      {
        imageLink: 'https://cdn.example.com/albums/green-science-1.jpg',
        caption: 'Project displays',
        position: 1,
      },
    ],
  },
  {
    schoolName: 'Blue Horizon Academy',
    yearTitle: '2025-2026',
    title: 'Art Exhibition 2026',
    description: 'Student artwork displayed at Blue Horizon Academy.',
    date: '2026-05-10',
    images: [
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
];

async function seedAlbums(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const item of FAKE_ALBUMS) {
    const school = await prisma.school.findFirst({
      where: { name: item.schoolName, isActive: true },
      select: { id: true },
    });

    if (!school) {
      console.log(`  skipped album "${item.title}" — school ${item.schoolName} not found`);
      skipped += 1;
      continue;
    }

    const year = await prisma.year.findFirst({
      where: {
        schoolId: school.id,
        title: item.yearTitle,
      },
      select: { id: true },
    });

    if (!year) {
      console.log(`  skipped album "${item.title}" — year ${item.yearTitle} not found`);
      skipped += 1;
      continue;
    }

    const albumDate = new Date(item.date);

    const existing = await prisma.album.findFirst({
      where: {
        schoolId: school.id,
        yearId: year.id,
        title: item.title,
        date: albumDate,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.album.create({
      data: {
        schoolId: school.id,
        yearId: year.id,
        title: item.title,
        description: item.description,
        date: albumDate,
        status: 1,
        images: {
          create: item.images,
        },
      },
    });

    created += 1;
  }

  console.log(`  albums: ${created} created, ${skipped} skipped`);
}

async function findOrCreateGradeType(title: string): Promise<number> {
  const existing = await prisma.gradeType.findFirst({
    where: { title, status: true },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.gradeType.create({
    data: {
      title,
      type: 'exam',
      isMain: true,
      position: title === 'Midterm' ? 1 : 2,
    },
    select: { id: true },
  });

  return created.id;
}

const FAKE_EXAM_SCHEDULES: Array<{
  studentUsername: string;
  gradeTypeTitle: string;
  title: string;
  note?: string;
  dates: Array<{
    date: string;
    exams: Array<{
      courseTitle: string;
      position: number;
      startTime: string;
      duration: number;
      note?: string;
    }>;
  }>;
}> = [
  {
    studentUsername: 'layla.khalil',
    gradeTypeTitle: 'Midterm',
    title: 'Midterm Exams 2026',
    note: 'Please arrive 15 minutes before each exam.',
    dates: [
      {
        date: '2026-06-10',
        exams: [
          { courseTitle: 'Mathematics', position: 1, startTime: '09:00', duration: 90 },
          { courseTitle: 'English', position: 2, startTime: '11:00', duration: 60 },
        ],
      },
      {
        date: '2026-06-12',
        exams: [
          {
            courseTitle: 'Mathematics',
            position: 1,
            startTime: '09:00',
            duration: 90,
            note: 'Room 204',
          },
        ],
      },
    ],
  },
  {
    studentUsername: 'layla.khalil',
    gradeTypeTitle: 'Final',
    title: 'Final Exams 2026',
    dates: [
      {
        date: '2026-06-20',
        exams: [
          { courseTitle: 'Mathematics', position: 1, startTime: '08:30', duration: 120 },
          { courseTitle: 'English', position: 2, startTime: '11:00', duration: 90 },
        ],
      },
    ],
  },
  {
    studentUsername: 'omar.khalil',
    gradeTypeTitle: 'Midterm',
    title: 'Midterm Exams 2026',
    note: 'Bring your student ID card.',
    dates: [
      {
        date: '2026-06-11',
        exams: [{ courseTitle: 'Mathematics', position: 1, startTime: '10:00', duration: 90 }],
      },
    ],
  },
];

async function seedExamSchedules(): Promise<void> {
  let created = 0;
  let skipped = 0;

  for (const item of FAKE_EXAM_SCHEDULES) {
    const student = await resolveStudentForNotice(item.studentUsername);
    const section = student?.registrations[0]?.section;

    if (!student || !section) {
      console.log(
        `  skipped exam schedule "${item.title}" — student ${item.studentUsername} not found`,
      );
      skipped += 1;
      continue;
    }

    const fullSection = await prisma.section.findUnique({
      where: { id: section.id },
      select: { classId: true, yearId: true, schoolId: true },
    });

    if (!fullSection) {
      skipped += 1;
      continue;
    }

    const recorderId = await findRecorderForSchool(fullSection.schoolId);

    if (!recorderId) {
      console.log(
        `  skipped exam schedule "${item.title}" — no recorder for school ${fullSection.schoolId}`,
      );
      skipped += 1;
      continue;
    }

    const gradeTypeId = await findOrCreateGradeType(item.gradeTypeTitle);

    const existing = await prisma.examSchedule.findFirst({
      where: {
        title: item.title,
        classId: fullSection.classId,
        yearId: fullSection.yearId,
        gradeTypeId,
        status: true,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const datesPayload: Array<{
      date: Date;
      details: {
        create: Array<{
          courseId: number;
          position: number;
          startTime: string;
          duration: number;
          note?: string;
        }>;
      };
    }> = [];

    for (const examDate of item.dates) {
      const examsPayload: Array<{
        courseId: number;
        position: number;
        startTime: string;
        duration: number;
        note?: string;
      }> = [];

      for (const exam of examDate.exams) {
        const course = await findCourseForSchool(fullSection.schoolId, exam.courseTitle);

        if (!course) {
          continue;
        }

        examsPayload.push({
          courseId: course.id,
          position: exam.position,
          startTime: exam.startTime,
          duration: exam.duration,
          note: exam.note,
        });
      }

      if (examsPayload.length === 0) {
        continue;
      }

      datesPayload.push({
        date: new Date(examDate.date),
        details: { create: examsPayload },
      });
    }

    if (datesPayload.length === 0) {
      console.log(`  skipped exam schedule "${item.title}" — no valid courses found`);
      skipped += 1;
      continue;
    }

    await prisma.examSchedule.create({
      data: {
        title: item.title,
        classId: fullSection.classId,
        yearId: fullSection.yearId,
        gradeTypeId,
        personId: recorderId,
        note: item.note,
        dates: { create: datesPayload },
      },
    });

    created += 1;
  }

  console.log(`  exam schedules: ${created} created, ${skipped} skipped`);
}

const FAKE_GRADES: Array<{
  studentUsername: string;
  courseTitle: string;
  gradeTypeTitle: string;
  maxGrade: number;
  score: number;
  comment?: string;
}> = [
  {
    studentUsername: 'layla.khalil',
    courseTitle: 'Mathematics',
    gradeTypeTitle: 'Midterm',
    maxGrade: 100,
    score: 86.5,
    comment: 'Good work',
  },
  {
    studentUsername: 'layla.khalil',
    courseTitle: 'English',
    gradeTypeTitle: 'Midterm',
    maxGrade: 100,
    score: 91,
  },
  {
    studentUsername: 'omar.khalil',
    courseTitle: 'Mathematics',
    gradeTypeTitle: 'Midterm',
    maxGrade: 100,
    score: 78,
    comment: 'Needs more practice',
  },
  {
    studentUsername: 'rana.hassan',
    courseTitle: 'Mathematics',
    gradeTypeTitle: 'Midterm',
    maxGrade: 100,
    score: 88,
  },
];

async function seedGrades(): Promise<void> {
  let created = 0;
  let skipped = 0;
  const publishedAt = new Date('2026-06-15T08:00:00.000Z');

  for (const item of FAKE_GRADES) {
    const student = await resolveStudentForNotice(item.studentUsername);
    const section = student?.registrations[0]?.section;

    if (!student || !section) {
      console.log(`  skipped grade "${item.courseTitle}" — student ${item.studentUsername} not found`);
      skipped += 1;
      continue;
    }

    const fullSection = await prisma.section.findUnique({
      where: { id: section.id },
      select: { id: true, schoolId: true },
    });

    const registration = await prisma.registration.findFirst({
      where: {
        studentId: student.id,
        sectionId: section.id,
        status: true,
      },
      select: { id: true },
    });

    if (!fullSection || !registration) {
      skipped += 1;
      continue;
    }

    const recorderId = await findRecorderForSchool(fullSection.schoolId);

    if (!recorderId) {
      skipped += 1;
      continue;
    }

    const course = await findCourseForSchool(fullSection.schoolId, item.courseTitle);

    if (!course) {
      console.log(`  skipped grade "${item.courseTitle}" — course not found`);
      skipped += 1;
      continue;
    }

    const gradeTypeId = await findOrCreateGradeType(item.gradeTypeTitle);

    const existing = await prisma.grade.findFirst({
      where: {
        schoolId: fullSection.schoolId,
        sectionId: fullSection.id,
        courseId: course.id,
        gradeTypeId,
        details: { some: { registrationId: registration.id } },
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.grade.create({
      data: {
        schoolId: fullSection.schoolId,
        sectionId: fullSection.id,
        courseId: course.id,
        gradeTypeId,
        maxGrade: item.maxGrade,
        publishDate: publishedAt,
        personId: recorderId,
        details: {
          create: {
            registrationId: registration.id,
            grade: item.score,
            comment: item.comment,
          },
        },
      },
    });

    created += 1;
  }

  console.log(`  grades: ${created} created, ${skipped} skipped`);
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
  await seedAlbums();
  await seedExamSchedules();
  await seedGrades();

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
  console.log('  GET /api/v1/parent/me/agendas?agendaDate=2026-08-10');
  console.log('  GET /api/v1/parent/me/agendas?agendaDate=2026-08-10&studentId=1');
  console.log('');
  console.log('Test albums API:');
  console.log('  GET /api/v1/parent/me/albums');
  console.log('  GET /api/v1/parent/me/albums?studentId=1');
  console.log('  GET /api/v1/parent/me/albums/1');
  console.log('');
  console.log('Test exam schedules API:');
  console.log('  GET /api/v1/parent/me/exam-schedules');
  console.log('  GET /api/v1/parent/me/exam-schedules?studentId=1');
  console.log('  GET /api/v1/parent/me/exam-schedules/1');
  console.log('');
  console.log('Test grades API:');
  console.log('  GET /api/v1/parent/me/grades');
  console.log('  GET /api/v1/parent/me/grades?studentId=1');
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

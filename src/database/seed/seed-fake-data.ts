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

async function seedNoticesIfEmpty(): Promise<void> {
  const existingCount = await prisma.notice.count({
    where: { deletedAt: null },
  });

  if (existingCount > 0) {
    console.log(`  notices already exist (${existingCount}) — skipped`);
    return;
  }

  const recorder = await prisma.person.findFirst({
    where: { status: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (!recorder) {
    console.log('  no person found — skipped notices');
    return;
  }

  const layla = await prisma.student.findFirst({
    where: { person: { username: 'layla.khalil' } },
    include: {
      registrations: {
        where: { status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { sectionId: true },
      },
    },
  });

  const omar = await prisma.student.findFirst({
    where: { person: { username: 'omar.khalil' } },
    include: {
      registrations: {
        where: { status: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { sectionId: true },
      },
    },
  });

  const laylaSectionId = layla?.registrations[0]?.sectionId;
  const omarSectionId = omar?.registrations[0]?.sectionId;

  if (laylaSectionId) {
    const laylaSection = await prisma.section.findUnique({
      where: { id: laylaSectionId },
      select: { schoolId: true },
    });

    if (laylaSection) {
      await prisma.notice.create({
        data: {
          schoolId: laylaSection.schoolId,
          description: 'Please submit the medical form by Friday.',
          personId: recorder.id,
          date: new Date('2026-08-10'),
          sections: { create: { sectionId: laylaSectionId } },
        },
      });
    }
  }

  if (layla) {
    const laylaSchoolId = (
      await prisma.student.findUnique({
        where: { id: layla.id },
        select: { person: { select: { schoolId: true } } },
      })
    )?.person.schoolId;

    if (laylaSchoolId) {
      await prisma.notice.create({
        data: {
          schoolId: laylaSchoolId,
          description: 'Reminder: science project is due next week.',
          personId: recorder.id,
          date: new Date('2026-08-08'),
          students: { create: { studentId: layla.id } },
        },
      });
    }
  }

  if (omarSectionId) {
    const omarSection = await prisma.section.findUnique({
      where: { id: omarSectionId },
      select: { schoolId: true },
    });

    if (omarSection) {
      await prisma.notice.create({
        data: {
          schoolId: omarSection.schoolId,
          description: 'Library books must be returned before the end of the month.',
          personId: recorder.id,
          date: new Date('2026-08-09'),
          sections: { create: { sectionId: omarSectionId } },
        },
      });
    }
  }

  console.log('  created demo notices');
}

async function main(): Promise<void> {
  console.log('Adding fake demo data (does NOT delete existing data)...');
  console.log('');

  await seedSchoolDetailsIfMissing();
  await seedAnnouncementsIfEmpty();
  await seedActivitiesIfEmpty();
  await seedAttendanceAbsences();
  await seedNoticesIfEmpty();

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
}

main()
  .catch((error: unknown) => {
    console.error('Fake data seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.disconnect();
  });

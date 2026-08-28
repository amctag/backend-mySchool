export const STANDARD_CLASSES: Array<{
  className: string;
  classLevel: number;
  stage: 'kindergarten' | 'primary' | 'intermediate' | 'secondary';
}> = [
  { className: 'Kindergarten 1', classLevel: 1, stage: 'kindergarten' },
  { className: 'Kindergarten 2', classLevel: 2, stage: 'kindergarten' },
  { className: 'Grade 1', classLevel: 1, stage: 'primary' },
  { className: 'Grade 2', classLevel: 2, stage: 'primary' },
  { className: 'Grade 3', classLevel: 3, stage: 'primary' },
  { className: 'Grade 4', classLevel: 4, stage: 'primary' },
  { className: 'Grade 5', classLevel: 5, stage: 'primary' },
  { className: 'Grade 6', classLevel: 6, stage: 'primary' },
  { className: 'Grade 7', classLevel: 7, stage: 'intermediate' },
  { className: 'Grade 8', classLevel: 8, stage: 'intermediate' },
  { className: 'Grade 9', classLevel: 9, stage: 'intermediate' },
  { className: 'Grade 10', classLevel: 10, stage: 'secondary' },
  { className: 'Grade 11 - Sciences', classLevel: 11, stage: 'secondary' },
  { className: 'Grade 11 - Humanities', classLevel: 11, stage: 'secondary' },
  { className: 'Grade 12 - General Sciences', classLevel: 12, stage: 'secondary' },
  { className: 'Grade 12 - Life Sciences', classLevel: 12, stage: 'secondary' },
  {
    className: 'Grade 12 - Sociology and Economics',
    classLevel: 12,
    stage: 'secondary',
  },
  { className: 'Grade 12 - Humanities', classLevel: 12, stage: 'secondary' },
];

export const STANDARD_STAGES: Array<{
  key: (typeof STANDARD_CLASSES)[number]['stage'];
  title: string;
  position: number;
}> = [
  { key: 'kindergarten', title: 'Kindergarten', position: 1 },
  { key: 'primary', title: 'Primary', position: 2 },
  { key: 'intermediate', title: 'Intermediate', position: 3 },
  { key: 'secondary', title: 'Secondary', position: 4 },
];

type StandardClassDb = {
  school: {
    findMany: (args: {
      select: { id: true; name: true };
      orderBy: { id: 'asc' };
    }) => Promise<Array<{ id: number; name: string }>>;
  };
  stage: {
    findFirst: (args: {
      where: { schoolId: number; title: string };
      select: { id: true };
    }) => Promise<{ id: number } | null>;
    create: (args: {
      data: { schoolId: number; title: string; position: number };
      select: { id: true };
    }) => Promise<{ id: number }>;
  };
  class: {
    findFirst: (args: {
      where: { className: string; stage: { schoolId: number } };
      select: { id: true };
    }) => Promise<{ id: number } | null>;
    create: (args: {
      data: {
        className: string;
        stageId: number;
        classLevel: number;
        position: number;
      };
    }) => Promise<unknown>;
    count: (args: { where: { stage: { schoolId: number } } }) => Promise<number>;
  };
};

export async function ensureStandardClassesForSchool(
  prisma: StandardClassDb,
  schoolId: number,
): Promise<number> {
  const existingCount = await prisma.class.count({
    where: { stage: { schoolId } },
  });
  if (existingCount >= STANDARD_CLASSES.length) {
    return 0;
  }

  const stageIds: Record<(typeof STANDARD_STAGES)[number]['key'], number> = {
    kindergarten: 0,
    primary: 0,
    intermediate: 0,
    secondary: 0,
  };

  for (const stage of STANDARD_STAGES) {
    const existing = await prisma.stage.findFirst({
      where: { schoolId, title: stage.title },
      select: { id: true },
    });
    const row =
      existing ??
      (await prisma.stage.create({
        data: {
          schoolId,
          title: stage.title,
          position: stage.position,
        },
        select: { id: true },
      }));
    stageIds[stage.key] = row.id;
  }

  let created = 0;
  for (const [index, item] of STANDARD_CLASSES.entries()) {
    const exists = await prisma.class.findFirst({
      where: {
        className: item.className,
        stage: { schoolId },
      },
      select: { id: true },
    });
    if (exists) {
      continue;
    }

    await prisma.class.create({
      data: {
        className: item.className,
        stageId: stageIds[item.stage],
        classLevel: item.classLevel,
        position: index + 1,
      },
    });
    created += 1;
  }

  return created;
}

export async function ensureStandardClassesForAllSchools(
  prisma: StandardClassDb,
): Promise<void> {
  const schools = await prisma.school.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });

  for (const school of schools) {
    const created = await ensureStandardClassesForSchool(prisma, school.id);
    if (created > 0) {
      console.log(`  ${school.name}: ${created} class(es) added`);
    }
  }
}

import { LEBANON_GOVERNORATES } from './lebanon-geography';

type LookupPrisma = {
  nationality: {
    upsert: (args: {
      where: { name: string };
      create: { name: string; isDefault: boolean };
      update: { isDefault: boolean };
    }) => Promise<unknown>;
  };
  parentJob: {
    upsert: (args: {
      where: { name: string };
      create: { name: string };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
  governorate: {
    upsert: (args: {
      where: { name: string };
      create: { name: string; code: number };
      update: { code: number };
    }) => Promise<{ id: number }>;
  };
  region: {
    upsert: (args: {
      where: {
        governorateId_name: { governorateId: number; name: string };
      };
      create: { name: string; governorateId: number };
      update: Record<string, never>;
    }) => Promise<unknown>;
  };
};

export async function seedLookups(prisma: LookupPrisma): Promise<void> {
  const nationalities = [
    { name: 'Lebanese', isDefault: true },
    { name: 'Syrian', isDefault: false },
    { name: 'Jordanian', isDefault: false },
  ] as const;

  for (const nationality of nationalities) {
    await prisma.nationality.upsert({
      where: { name: nationality.name },
      create: nationality,
      update: { isDefault: nationality.isDefault },
    });
  }

  for (const name of ['Employee', 'Teacher', 'Engineer', 'Other']) {
    await prisma.parentJob.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  for (const governorate of LEBANON_GOVERNORATES) {
    const saved = await prisma.governorate.upsert({
      where: { name: governorate.name },
      create: { name: governorate.name, code: governorate.code },
      update: { code: governorate.code },
    });

    for (const name of governorate.regions) {
      await prisma.region.upsert({
        where: {
          governorateId_name: {
            governorateId: saved.id,
            name,
          },
        },
        create: {
          name,
          governorateId: saved.id,
        },
        update: {},
      });
    }
  }
}

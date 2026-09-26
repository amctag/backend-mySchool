import { seedLookups } from './seed-lookups';

type Upsert = jest.Mock<Promise<unknown>, [unknown]>;

function upsert(): Upsert {
  return jest.fn(async () => ({}));
}

describe('seedLookups accounting reference data', () => {
  it('upserts every accounting register type and item type by name', async () => {
    const accountingRegisterTypeUpsert = upsert();
    const itemTypeUpsert = upsert();
    const currencyUpsert = upsert();
    const prisma = {
      nationality: { upsert: upsert() },
      parentJob: { upsert: upsert() },
      bloodType: { upsert: upsert() },
      governorate: {
        upsert: jest.fn(async () => ({ id: 1 })),
      },
      region: { upsert: upsert() },
      accountingRegisterType: { upsert: accountingRegisterTypeUpsert },
      itemType: { upsert: itemTypeUpsert },
      currency: { upsert: currencyUpsert },
    };

    await seedLookups(prisma);

    expect(
      accountingRegisterTypeUpsert.mock.calls.map(([args]) => args),
    ).toEqual(
      [
        'Receipt',
        'Payment',
        'Sales',
        'Purchase',
        'Sales Return',
        'Purchase Return',
      ].map((name) => ({
        where: { name },
        create: { name },
        update: {},
      })),
    );
    expect(itemTypeUpsert.mock.calls.map(([args]) => args)).toEqual(
      ['Product', 'Services'].map((name) => ({
        where: { name },
        create: { name },
        update: {},
      })),
    );
    expect(currencyUpsert.mock.calls.map(([args]) => args)).toEqual([
      {
        where: { shortCode: 'USD' },
        create: { title: 'US Dollar', shortCode: 'USD', symbol: '$', rate: 1 },
        update: {},
      },
      {
        where: { shortCode: 'LBP' },
        create: {
          title: 'Lebanese Pound',
          shortCode: 'LBP',
          symbol: 'L.L',
          rate: 1,
        },
        update: {},
      },
    ]);
  });
});

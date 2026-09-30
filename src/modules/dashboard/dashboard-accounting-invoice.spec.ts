import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { DashboardAccountingService } from './dashboard-accounting.service';
import { CreateDashboardInvoiceDto } from './dto/dashboard-accounting.dto';

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('unique', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

const lockedParent = {
  parentId: 7,
  personId: 70,
  accountId: 12,
  firstName: 'John',
  middleName: '',
  lastName: 'Doe',
  accountCode: '100001',
  accountSchoolId: 3,
};

const usdCurrency = {
  id: 1,
  title: 'US Dollar',
  shortCode: 'USD',
  symbol: '$',
  rate: '1',
};

const salesAccount = { id: 55, code: '400001', name: 'Sales', type: 'SALES' };

function invoiceTransaction(overrides?: {
  queryRawResults?: unknown[];
  classRow?: unknown;
  yearRow?: unknown;
  packageRow?: unknown;
  studentRow?: unknown;
  sectionRow?: unknown;
  existingRegistration?: unknown;
  items?: unknown[];
  parentRegistrations?: unknown[];
  currency?: unknown;
  salesAccount?: unknown;
  branch?: unknown;
  registerType?: { id: number } | null;
  registerCreate?: { id: number };
  registerFindFirst?: unknown;
  invoiceCreate?: unknown;
  creator?: unknown;
  dailyRows?: Array<{ accountId: number; debit: unknown; credit: unknown }>;
}) {
  const queue = [...(overrides?.queryRawResults ?? [])];
  const has = (key: 'classRow' | 'yearRow' | 'packageRow' | 'studentRow' | 'sectionRow' | 'existingRegistration' | 'items' | 'parentRegistrations' | 'currency' | 'salesAccount' | 'branch' | 'creator' | 'dailyRows') =>
    overrides !== undefined && key in (overrides as Record<string, unknown>);
  let branchServed = false;
  const tx = {
    $queryRaw: jest.fn(() => {
      const next = queue.shift();
      if (next instanceof Error) {
        throw next;
      }
      return Promise.resolve(next);
    }),
    class: {
      findFirst: jest.fn(() =>
        Promise.resolve(
          has('classRow') ? overrides?.classRow : { id: 4, className: 'Grade 1' },
        ),
      ),
    },
    year: {
      findFirst: jest.fn(() =>
        Promise.resolve(
          has('yearRow') ? overrides?.yearRow : { id: 2, title: '2026-2027' },
        ),
      ),
    },
    accountingRegistrationPackage: {
      findFirst: jest.fn(() =>
        Promise.resolve(has('packageRow') ? overrides?.packageRow : null),
      ),
    },
    student: {
      findFirst: jest.fn(() =>
        Promise.resolve(has('studentRow') ? overrides?.studentRow : null),
      ),
    },
    section: {
      findFirst: jest.fn(() =>
        Promise.resolve(has('sectionRow') ? overrides?.sectionRow : null),
      ),
    },
    registration: {
      findFirst: jest.fn(() =>
        Promise.resolve(
          has('existingRegistration') ? overrides?.existingRegistration : null,
        ),
      ),
      findMany: jest.fn(() =>
        Promise.resolve(has('parentRegistrations') ? overrides?.parentRegistrations : []),
      ),
      create: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 450, ...args.data }),
      ),
    },
    item: {
      findMany: jest.fn(() =>
        Promise.resolve(has('items') ? overrides?.items : []),
      ),
    },
    currency: {
      findUnique: jest.fn(() =>
        Promise.resolve(has('currency') ? overrides?.currency : null),
      ),
    },
    account: {
      findFirst: jest.fn(() => {
        if (has('branch') && !branchServed) {
          branchServed = true;
          return Promise.resolve(overrides?.branch);
        }
        return Promise.resolve(has('salesAccount') ? overrides?.salesAccount : salesAccount);
      }),
      findUnique: jest.fn(() => Promise.resolve(null)),
      create: jest.fn((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 12, ...args.data }),
      ),
    },
    person: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    accountingRegisterType: {
      findUnique: jest.fn(() =>
        Promise.resolve(overrides?.registerType ?? { id: 7 }),
      ),
    },
    accountingRegister: {
      create: jest.fn(() =>
        Promise.resolve(
          overrides?.registerCreate ?? {
            id: 500,
            dateCreated: new Date('2026-09-29T10:00:00.000Z'),
          },
        ),
      ),
      findFirst: jest.fn(() =>
        Promise.resolve(overrides?.registerFindFirst ?? null),
      ),
    },
    accountingInvoice: {
      create: jest.fn(() =>
        Promise.resolve(overrides?.invoiceCreate ?? { id: 900 }),
      ),
      findFirst: jest.fn(),
    },
    accountingInvoiceDetail: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
    },
    accountingDaily: {
      createMany: jest.fn((args: { data: unknown[] }) =>
        Promise.resolve({ count: args.data.length }),
      ),
      findMany: jest.fn(() => Promise.resolve(overrides?.dailyRows ?? [])),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (t: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    person: {
      findUnique: jest.fn(() =>
        Promise.resolve(overrides?.creator ?? { id: 1 }),
      ),
    },
    class: tx.class,
    year: tx.year,
    accountingRegistrationPackage: tx.accountingRegistrationPackage,
    parent: { findFirst: jest.fn() },
    registration: tx.registration,
  };
  const service = new DashboardAccountingService(prisma as never);
  return { tx, prisma, service };
}

const grade1Package = {
  id: 5,
  name: 'Grade 1 Registration Package',
  items: [
    {
      itemId: 3,
      price: '100',
      mandatory: true,
      currencyId: 1,
      item: {
        id: 3,
        name: 'Registration Fee',
        price: '100',
        schoolId: 3,
        itemType: { name: 'Services' },
      },
      currency: { id: 1, title: 'US Dollar', shortCode: 'USD', symbol: '$', rate: '1' },
    },
    {
      itemId: 4,
      price: '75',
      mandatory: false,
      currencyId: 1,
      item: {
        id: 4,
        name: 'Books',
        price: '75',
        schoolId: 3,
        itemType: { name: 'Product' },
      },
      currency: { id: 1, title: 'US Dollar', shortCode: 'USD', symbol: '$', rate: '1' },
    },
  ],
};

describe('Registration package preview', () => {
  it('returns the package with items, prices, and currency for a class with a package', async () => {
    const { service } = invoiceTransaction({ packageRow: grade1Package });
    const preview = await service.getRegistrationPackagePreview(
      { schoolId: 3 } as never,
      4,
      2,
    );
    expect(preview.package?.name).toBe('Grade 1 Registration Package');
    expect(preview.package?.items).toHaveLength(2);
    expect(preview.package?.items[0]).toEqual(
      expect.objectContaining({ itemName: 'Registration Fee', price: '100.00' }),
    );
    expect(preview.package?.items[0].currency?.shortCode).toBe('USD');
  });

  it('returns an empty package result for a class without a package', async () => {
    const { service } = invoiceTransaction({ packageRow: null });
    const preview = await service.getRegistrationPackagePreview(
      { schoolId: 3 } as never,
      4,
      2,
    );
    expect(preview.package).toBeNull();
  });

  it('rejects a class from another school', async () => {
    const { service } = invoiceTransaction({ classRow: null });
    await expect(
      service.getRegistrationPackagePreview({ schoolId: 3 } as never, 99, 2),
    ).rejects.toThrow('Class not found');
  });

  it('returns no package for the wrong school year', async () => {
    const { tx, service } = invoiceTransaction({ packageRow: null });
    const preview = await service.getRegistrationPackagePreview(
      { schoolId: 3 } as never,
      4,
      77,
    );
    expect(preview.package).toBeNull();
    expect(
      tx.accountingRegistrationPackage.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ yearId: 77 }),
      }),
    );
  });
});

describe('Registration + Invoice atomic creation', () => {
  function registrationMocks() {
    return invoiceTransaction({
      queryRawResults: [[lockedParent], [{ nb: 1005 }]],
      studentRow: { id: 11, parentId: 7 },
      sectionRow: { id: 9, yearId: 2 },
      packageRow: grade1Package,
      items: [
        { id: 3, name: 'Registration Fee', price: '100' },
        { id: 4, name: 'Books', price: '75' },
      ],
      currency: usdCurrency,
      dailyRows: [
        { accountId: 12, debit: '175.00', credit: '0' },
        { accountId: 55, debit: '0', credit: '175.00' },
      ],
    });
  }

  it('creates 1 registration, 1 register, 1 invoice, and 2 details linked to the registration', async () => {
    const { tx, service } = registrationMocks();
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 900 } as never);

    const result = await service.createRegistrationWithInvoice(
      { schoolId: 3 } as never,
      {
        studentId: 11,
        classId: 4,
        sectionId: 9,
        currencyId: 1,
        items: [{ itemId: 3 }, { itemId: 4 }],
      },
    );

    expect(result.registrationId).toBe(450);
    expect(tx.registration.create).toHaveBeenCalledTimes(1);
    expect(tx.accountingRegister.create).toHaveBeenCalledTimes(1);
    expect(tx.accountingInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nb: 1005, schoolId: 3 }),
      }),
    );
    expect(tx.accountingInvoiceDetail.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ itemId: 3, forRegistrationId: 450 }),
        expect.objectContaining({ itemId: 4, forRegistrationId: 450 }),
      ]),
    });
    expect(
      tx.accountingInvoiceDetail.createMany.mock.calls[0][0].data,
    ).toHaveLength(2);
  });

  it('posts a balanced parent-debit / sales-credit journal for the package total', async () => {
    const { tx, service } = registrationMocks();
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 900 } as never);

    await service.createRegistrationWithInvoice({ schoolId: 3 } as never, {
      studentId: 11,
      classId: 4,
      sectionId: 9,
      currencyId: 1,
      items: [{ itemId: 3 }, { itemId: 4 }],
    });

    expect(tx.accountingDaily.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          accountId: 12,
          debit: new Prisma.Decimal(175),
          credit: new Prisma.Decimal(0),
        }),
        expect.objectContaining({
          accountId: 55,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(175),
        }),
      ],
    });
  });

  it('returns the original document on idempotent retry without new rows', async () => {
    const { tx, service } = registrationMocks();
    tx.accountingRegister.findFirst.mockResolvedValue({
      invoices: [{ id: 900, details: [{ forRegistrationId: 450 }] }],
    });
    jest
      .spyOn(service, 'getInvoice')
      .mockResolvedValue({ id: 900, nb: 1005 } as never);

    const result = await service.createRegistrationWithInvoice(
      { schoolId: 3 } as never,
      {
        studentId: 11,
        classId: 4,
        sectionId: 9,
        currencyId: 1,
        items: [{ itemId: 3 }],
        idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        registrationId: 450,
        invoice: expect.objectContaining({ id: 900 }),
      }),
    );
    expect(tx.registration.create).not.toHaveBeenCalled();
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
    expect(tx.accountingInvoice.create).not.toHaveBeenCalled();
  });

  it('rejects mixed package currencies instead of mis-totalling', async () => {
    const mixed = {
      ...grade1Package,
      items: [
        { ...grade1Package.items[0], currencyId: 1 },
        { ...grade1Package.items[1], currencyId: 2 },
      ],
    };
    const { service } = invoiceTransaction({
      studentRow: { id: 11, parentId: 7 },
      sectionRow: { id: 9, yearId: 2 },
      packageRow: mixed,
    });
    await expect(
      service.createRegistrationWithInvoice({ schoolId: 3 } as never, {
        studentId: 11,
        classId: 4,
        sectionId: 9,
        items: [{ itemId: 3 }, { itemId: 4 }],
      }),
    ).rejects.toThrow('different currencies');
  });
});

describe('Normal parent invoice with per-line registrations', () => {
  function normalMocks() {
    return invoiceTransaction({
      queryRawResults: [[lockedParent], [{ nb: 1006 }]],
      currency: usdCurrency,
      items: [
        { id: 5, name: 'Uniform', price: '50' },
        { id: 6, name: 'Book', price: '30' },
        { id: 7, name: 'General Fee', price: '20' },
      ],
      parentRegistrations: [
        {
          id: 450,
          student: { parentId: 7, person: { firstName: 'A', middleName: '', lastName: 'B' } },
          section: { schoolId: 3, class: { className: 'Grade 1' } },
        },
        {
          id: 700,
          student: { parentId: 7, person: { firstName: 'C', middleName: '', lastName: 'D' } },
          section: { schoolId: 3, class: { className: 'Grade 9' } },
        },
      ],
      dailyRows: [
        { accountId: 12, debit: '100.00', credit: '0' },
        { accountId: 55, debit: '0', credit: '100.00' },
      ],
    });
  }

  it('creates one invoice with 450/700/NULL lines totalling 100 on one register', async () => {
    const { tx, service } = normalMocks();
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 901 } as never);

    await service.createInvoice({ schoolId: 3 } as never, {
      parentId: 7,
      currencyId: 1,
      details: [
        { itemId: 5, unitPrice: 50, forRegistrationId: 450 },
        { itemId: 6, unitPrice: 30, forRegistrationId: 700 },
        { itemId: 7, unitPrice: 20 },
      ],
    });

    expect(tx.accountingRegister.create).toHaveBeenCalledTimes(1);
    expect(tx.accountingInvoice.create).toHaveBeenCalledTimes(1);
    const details = tx.accountingInvoiceDetail.createMany.mock.calls[0][0].data;
    expect(details).toHaveLength(3);
    expect(details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 5, forRegistrationId: 450 }),
        expect.objectContaining({ itemId: 6, forRegistrationId: 700 }),
        expect.objectContaining({ itemId: 7, forRegistrationId: null }),
      ]),
    );
    expect(tx.accountingDaily.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          accountId: 12,
          debit: new Prisma.Decimal(100),
        }),
        expect.objectContaining({
          accountId: 55,
          credit: new Prisma.Decimal(100),
        }),
      ],
    });
  });

  it('rejects a registration belonging to a different parent', async () => {
    const { service } = invoiceTransaction({
      queryRawResults: [[lockedParent]],
      currency: usdCurrency,
      items: [{ id: 5, name: 'Uniform', price: '50' }],
      parentRegistrations: [
        {
          id: 999,
          student: { parentId: 99, person: { firstName: 'X', middleName: '', lastName: 'Y' } },
          section: { schoolId: 3, class: { className: 'Grade 1' } },
        },
      ],
    });
    await expect(
      service.createInvoice({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        details: [{ itemId: 5, unitPrice: 50, forRegistrationId: 999 }],
      }),
    ).rejects.toThrow('does not belong to this parent');
  });

  it('rejects an item from another school', async () => {
    const { service } = invoiceTransaction({
      queryRawResults: [[lockedParent]],
      currency: usdCurrency,
      items: [],
    });
    await expect(
      service.createInvoice({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        details: [{ itemId: 5, unitPrice: 50 }],
      }),
    ).rejects.toThrow('does not belong to the authenticated school');
  });

  it('rejects an invalid currency', async () => {
    const { service } = invoiceTransaction({
      queryRawResults: [[lockedParent]],
      currency: null,
    });
    await expect(
      service.createInvoice({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 999,
        details: [{ itemId: 5, unitPrice: 50 }],
      }),
    ).rejects.toThrow('Invalid currency');
  });
});

describe('Invoice-time parent account creation (4111 rule)', () => {
  const unlinkedParent = {
    ...lockedParent,
    accountId: null,
    accountCode: null,
    accountSchoolId: null,
  };
  const branch = { id: 53, code: '4111', name: 'Ordinary', isGroup: true };

  function autoCreateMocks(branchOverride: unknown) {
    return invoiceTransaction({
      // lockParent; allocate: ensure+lock (last=0), max existing (none),
      // bump; sync select, sync upsert; invoice numbering
      queryRawResults: [
        [unlinkedParent],
        [{ seq: 0 }],
        [],
        [],
        [{ code: '41110001' }],
        [],
        [{ nb: 42 }],
      ],
      branch: branchOverride,
      currency: usdCurrency,
      items: [{ id: 3, name: 'Registration Fee', price: '100' }],
      dailyRows: [
        { accountId: 12, debit: '100.00', credit: '0' },
        { accountId: 55, debit: '0', credit: '100.00' },
      ],
    });
  }

  it('auto-creates an 8-digit PERSON leaf under the 4111 account id', async () => {
    const { tx, service } = autoCreateMocks(branch);
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 900 } as never);

    await service.createInvoice({ schoolId: 3 } as never, {
      parentId: 7,
      currencyId: 1,
      details: [{ itemId: 3 }],
    } as never);

    expect(tx.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: '41110001',
          type: 'PERSON',
          schoolId: 3,
          parentId: 53,
          isGroup: false,
        }),
      }),
    );
    expect(tx.person.update).toHaveBeenCalledWith({
      where: { id: 70 },
      data: { accountId: 12 },
    });
  });

  it('fails cleanly when the school has no 4111 branch', async () => {
    const { tx, service } = autoCreateMocks(null);

    await expect(
      service.createInvoice({ schoolId: 3 } as never, {
        parentId: 7,
        currencyId: 1,
        details: [{ itemId: 3 }],
      } as never),
    ).rejects.toThrow('4111');
    expect(tx.account.create).not.toHaveBeenCalled();
    expect(tx.accountingRegister.create).not.toHaveBeenCalled();
  });
});

describe('CreateDashboardInvoiceDto contract', () => {  async function errors(body: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(CreateDashboardInvoiceDto, body as object);
    const list = await validate(dto);
    return list.map((error) => error.property);
  }

  it('accepts a multi-child invoice with optional registration links', async () => {
    await expect(
      errors({
        parentId: 7,
        currencyId: 1,
        details: [
          { itemId: 5, unitPrice: 50, forRegistrationId: 450 },
          { itemId: 7, unitPrice: 20 },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it('rejects an empty invoice', async () => {
    await expect(
      errors({ parentId: 7, currencyId: 1, details: [] }),
    ).resolves.toContain('details');
  });

  it('rejects zero and negative prices', async () => {
    await expect(
      errors({
        parentId: 7,
        currencyId: 1,
        details: [{ itemId: 5, unitPrice: 0 }],
      }),
    ).resolves.toContain('details');
    await expect(
      errors({
        parentId: 7,
        currencyId: 1,
        details: [{ itemId: 5, unitPrice: -10 }],
      }),
    ).resolves.toContain('details');
  });
});

describe('Invoice duplicate items', () => {
  function duplicateMocks() {
    return invoiceTransaction({
      queryRawResults: [[lockedParent], [{ nb: 1007 }]],
      currency: usdCurrency,
      items: [{ id: 8, name: 'Pants', price: '150' }],
      parentRegistrations: [
        {
          id: 450,
          student: {
            parentId: 7,
            person: { firstName: 'Adam', middleName: '', lastName: 'X' },
          },
          section: { schoolId: 3, class: { className: 'Grade 3' } },
        },
        {
          id: 701,
          student: {
            parentId: 7,
            person: { firstName: 'Ziad', middleName: '', lastName: 'Y' },
          },
          section: { schoolId: 3, class: { className: 'Grade 3' } },
        },
      ],
      dailyRows: [
        { accountId: 12, debit: '300.00', credit: '0' },
        { accountId: 55, debit: '0', credit: '300.00' },
      ],
    });
  }

  it('accepts the same item on two lines with different registrations', async () => {
    const { tx, service } = duplicateMocks();
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 902 } as never);

    await service.createInvoice({ schoolId: 3 } as never, {
      parentId: 7,
      currencyId: 1,
      details: [
        { itemId: 8, unitPrice: 150, forRegistrationId: 450 },
        { itemId: 8, unitPrice: 150, forRegistrationId: 701 },
      ],
    });

    const details = tx.accountingInvoiceDetail.createMany.mock.calls[0][0].data;
    expect(details).toHaveLength(2);
    expect(details[0]).toEqual(
      expect.objectContaining({ itemId: 8, forRegistrationId: 450 }),
    );
    expect(details[1]).toEqual(
      expect.objectContaining({ itemId: 8, forRegistrationId: 701 }),
    );
  });

  it('accepts the same item twice with NULL registrations', async () => {
    const { tx, service } = duplicateMocks();
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 903 } as never);

    await service.createInvoice({ schoolId: 3 } as never, {
      parentId: 7,
      currencyId: 1,
      details: [
        { itemId: 8, unitPrice: 150 },
        { itemId: 8, unitPrice: 150 },
      ],
    });

    const details = tx.accountingInvoiceDetail.createMany.mock.calls[0][0].data;
    expect(details).toHaveLength(2);
    expect(details).toEqual([
      expect.objectContaining({ itemId: 8, forRegistrationId: null }),
      expect.objectContaining({ itemId: 8, forRegistrationId: null }),
    ]);
  });
});

describe('Mandatory package items', () => {
  const mandatoryPackage = {
    ...grade1Package,
    items: [
      { ...grade1Package.items[0], mandatory: true },
      { ...grade1Package.items[1], mandatory: false },
    ],
  };

  function mandatoryMocks() {
    return invoiceTransaction({
      queryRawResults: [[lockedParent], [{ nb: 1008 }]],
      studentRow: { id: 11, parentId: 7 },
      sectionRow: { id: 9, yearId: 2 },
      packageRow: mandatoryPackage,
      items: [
        { id: 3, name: 'Registration Fee', price: '100' },
        { id: 4, name: 'Books', price: '75' },
      ],
      currency: usdCurrency,
      dailyRows: [
        { accountId: 12, debit: '100.00', credit: '0' },
        { accountId: 55, debit: '0', credit: '100.00' },
      ],
    });
  }

  it('rejects a request omitting a mandatory package item', async () => {
    const { tx, service } = mandatoryMocks();
    await expect(
      service.createRegistrationWithInvoice({ schoolId: 3 } as never, {
        studentId: 11,
        classId: 4,
        sectionId: 9,
        currencyId: 1,
        items: [{ itemId: 4 }],
      }),
    ).rejects.toThrow('mandatory');
    expect(tx.registration.create).not.toHaveBeenCalled();
    expect(tx.accountingInvoice.create).not.toHaveBeenCalled();
  });

  it('accepts a request containing the mandatory package item', async () => {
    const { tx, service } = mandatoryMocks();
    jest.spyOn(service, 'getInvoice').mockResolvedValue({ id: 904 } as never);

    const result = await service.createRegistrationWithInvoice(
      { schoolId: 3 } as never,
      {
        studentId: 11,
        classId: 4,
        sectionId: 9,
        currencyId: 1,
        items: [{ itemId: 3 }],
      },
    );

    expect(result.registrationId).toBe(450);
    expect(tx.accountingInvoiceDetail.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ itemId: 3, forRegistrationId: 450 }),
      ],
    });
  });
});

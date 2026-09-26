import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateDashboardAccountDto,
  CreateDashboardPaymentDto,
  CreateDashboardReceiptDto,
  DashboardAccountDto,
  DashboardAccountsQueryDto,
  DashboardAccountsResponseDto,
  DashboardAccountingDocumentQueryDto,
  DashboardCurrencyDto,
  DashboardPaymentDto,
  DashboardPaymentsResponseDto,
  DashboardReceiptAllocationDto,
  DashboardReceiptCurrencyDto,
  DashboardReceiptDto,
  DashboardReceiptsResponseDto,
  UpdateDashboardAccountDto,
} from './dto/dashboard-accounting.dto';

const SYSTEM_ACCOUNT_DEFINITIONS: Array<{ type: AccountType; name: string }> = [
  { type: 'CASH', name: 'Cash' },
  { type: 'SALES', name: 'Sales' },
  { type: 'PURCHASES', name: 'Purchases' },
];

/** Account types managed by the system. Manual create/edit is blocked for these. */
const PROTECTED_ACCOUNT_TYPES: ReadonlySet<string> = new Set([
  'PERSON',
  'CASH',
  'SALES',
  'PURCHASES',
]);

/** Account types eligible as receipt destinations in Phase 2C. */
const RECEIPT_DESTINATION_TYPES: ReadonlySet<string> = new Set([
  'CASH',
  'GENERAL',
]);

const ACCOUNT_TYPES: ReadonlySet<string> = new Set([
  'PERSON',
  'CASH',
  'SALES',
  'PURCHASES',
  'GENERAL',
]);

const MAX_ALLOCATIONS = 50;
const MAX_ACCOUNT_LIST_LIMIT = 500;
const DEFAULT_ACCOUNT_LIST_LIMIT = 100;

type LockedParentAccount = {
  parentId: number;
  personId: number;
  accountId: number | null;
  firstName: string;
  middleName: string;
  lastName: string;
  accountCode: string | null;
  accountSchoolId: number | null;
};

type AccountRow = {
  id: number;
  code: string;
  name: string;
  type: AccountType;
};

type AllocationInput = {
  accountId: number;
  amount: Prisma.Decimal;
  description: string | null;
  accountCode: string;
  accountName: string;
};

type ReceiptDetailRow = {
  accountId: number;
  amount: Prisma.Decimal | number | string;
  description: string | null;
  account: { id: number; code: string; name: string };
};

type JournalLine = {
  accountId: number;
  debit: Prisma.Decimal | number | string;
  credit: Prisma.Decimal | number | string;
  account: { id: number; code: string; name?: string };
};

type RegisterBlock = {
  description: string | null;
  currencyId: number | null;
  currencyRate: Prisma.Decimal | number | string | null;
  notes: string | null;
  comments: string | null;
  dateCreated: Date;
  currency: {
    id: number;
    title: string;
    shortCode: string;
    symbol: string;
    rate: Prisma.Decimal | number | string;
  } | null;
  dailyEntries: JournalLine[];
};

@Injectable()
export class DashboardAccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async listCurrencies(): Promise<DashboardCurrencyDto[]> {
    const currencies = await this.prisma.currency.findMany({
      select: {
        id: true,
        title: true,
        shortCode: true,
        symbol: true,
        rate: true,
      },
      orderBy: { id: 'asc' },
    });
    return currencies.map((currency) => ({
      id: currency.id,
      title: currency.title,
      shortCode: currency.shortCode,
      symbol: currency.symbol,
      rate: new Prisma.Decimal(currency.rate).toString(),
    }));
  }

  async listAccounts(
    user: AuthenticatedSchool,
    query: DashboardAccountsQueryDto,
  ): Promise<DashboardAccountsResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(
      query.limit ?? DEFAULT_ACCOUNT_LIST_LIMIT,
      MAX_ACCOUNT_LIST_LIMIT,
    );
    const search = query.search?.trim() || undefined;
    if (query.type !== undefined && !ACCOUNT_TYPES.has(query.type)) {
      throw new BadRequestException('Invalid account type filter');
    }
    const where: Prisma.AccountWhereInput = { schoolId: user.schoolId };
    if (query.type !== undefined) {
      where.type = query.type as AccountType;
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, accounts] = await this.prisma.$transaction([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
        select: { id: true, code: true, name: true, type: true },
        orderBy: [{ code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const personByAccountId = await this.resolveAccountPersons(
      accounts.map((account) => account.id),
    );

    return {
      items: accounts.map((account) =>
        this.toAccountDto(account, personByAccountId.get(account.id) ?? null),
      ),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async getAccount(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardAccountDto> {
    const account = await this.prisma.account.findFirst({
      where: { id, schoolId: user.schoolId },
      select: { id: true, code: true, name: true, type: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    const personByAccountId = await this.resolveAccountPersons([account.id]);
    return this.toAccountDto(
      account,
      personByAccountId.get(account.id) ?? null,
    );
  }

  async createAccount(
    user: AuthenticatedSchool,
    dto: CreateDashboardAccountDto,
  ): Promise<DashboardAccountDto> {
    if (dto.type !== 'GENERAL') {
      throw new BadRequestException(
        'Only GENERAL accounts can be created manually',
      );
    }
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Account name must not be empty');
    }
    return this.prisma.$transaction(async (tx) => {
      const [sequence] = await tx.$queryRaw<Array<{ code: string }>>`
        SELECT nextval('"account_code_seq"')::text AS code
      `;
      if (!sequence) {
        throw new ConflictException('Could not allocate an account code');
      }
      try {
        const created = await tx.account.create({
          data: {
            code: sequence.code,
            name,
            type: 'GENERAL',
            schoolId: user.schoolId,
          },
          select: { id: true, code: true, name: true, type: true },
        });
        return this.toAccountDto(created, null);
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException(
            'Account could not be created because it already exists',
          );
        }
        throw error;
      }
    });
  }

  async updateAccount(
    user: AuthenticatedSchool,
    id: number,
    dto: UpdateDashboardAccountDto,
  ): Promise<DashboardAccountDto> {
    const account = await this.prisma.account.findFirst({
      where: { id, schoolId: user.schoolId },
      select: { id: true, code: true, name: true, type: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (PROTECTED_ACCOUNT_TYPES.has(account.type)) {
      throw new BadRequestException(
        `Accounts of type ${account.type} cannot be edited manually`,
      );
    }
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Account name must not be empty');
    }
    const updated = await this.prisma.account.update({
      where: { id: account.id },
      data: { name },
      select: { id: true, code: true, name: true, type: true },
    });
    const personByAccountId = await this.resolveAccountPersons([updated.id]);
    return this.toAccountDto(
      updated,
      personByAccountId.get(updated.id) ?? null,
    );
  }

  async ensureSystemAccounts(
    user: AuthenticatedSchool,
  ): Promise<DashboardAccountDto[]> {
    return this.prisma.$transaction(async (tx) => {
      const accounts: DashboardAccountDto[] = [];
      for (const definition of SYSTEM_ACCOUNT_DEFINITIONS) {
        accounts.push(
          await this.ensureSystemAccount(
            tx,
            user.schoolId,
            definition.type,
            definition.name,
          ),
        );
      }
      return accounts;
    });
  }

  async createReceipt(
    user: AuthenticatedSchool,
    dto: CreateDashboardReceiptDto,
  ): Promise<DashboardReceiptDto> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await this.findReceiptByIdempotencyKey(
          tx,
          user.schoolId,
          dto.idempotencyKey,
        );
        if (existing) {
          return existing;
        }
      }

      const locked = await this.lockParentAccount(
        tx,
        user.schoolId,
        dto.parentId,
      );
      if (
        locked.accountId === null ||
        locked.accountSchoolId !== user.schoolId
      ) {
        throw new BadRequestException(
          'Parent has no accounting account for this school',
        );
      }

      const currency = await tx.currency.findUnique({
        where: { id: dto.currencyId },
        select: {
          id: true,
          title: true,
          shortCode: true,
          symbol: true,
          rate: true,
        },
      });
      if (!currency) {
        throw new BadRequestException('Invalid currency');
      }

      const allocations = await this.resolveAllocations(
        tx,
        user.schoolId,
        dto.allocations,
      );
      const total = allocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      );
      if (total.lte(0)) {
        throw new BadRequestException(
          'Receipt total must be greater than zero',
        );
      }

      const numbering = await this.nextDocumentNumber(
        tx,
        user.schoolId,
        'Receipt',
      );
      const currencyRate = new Prisma.Decimal(currency.rate);

      let register: { id: number; dateCreated: Date };
      try {
        register = await tx.accountingRegister.create({
          data: {
            description: dto.description ?? null,
            accountingRegisterTypeId: numbering.registerTypeId,
            currencyId: currency.id,
            notes: dto.notes ?? null,
            comments: dto.comments ?? null,
            currencyRate,
            schoolId: user.schoolId,
            idempotencyKey: dto.idempotencyKey ?? null,
          },
          select: { id: true, dateCreated: true },
        });
      } catch (error) {
        if (this.isUniqueViolation(error) && dto.idempotencyKey) {
          const existing = await this.findReceiptByIdempotencyKey(
            tx,
            user.schoolId,
            dto.idempotencyKey,
          );
          if (existing) {
            return existing;
          }
        }
        throw new ConflictException(
          'Receipt could not be created because it already exists',
        );
      }

      let receiptRow: { id: number };
      try {
        receiptRow = await tx.accountingReceipt.create({
          data: {
            accountingRegisterId: register.id,
            nb: numbering.nb,
            schoolId: user.schoolId,
          },
          select: { id: true },
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException(
            'Receipt number is already used for this school',
          );
        }
        throw error;
      }

      await tx.accountingReceiptDetail.createMany({
        data: allocations.map((allocation) => ({
          accountingReceiptId: receiptRow.id,
          accountId: allocation.accountId,
          amount: allocation.amount,
          description: allocation.description,
        })),
      });

      await tx.accountingDaily.createMany({
        data: [
          ...allocations.map((allocation) => ({
            accountId: allocation.accountId,
            debit: allocation.amount,
            credit: new Prisma.Decimal(0),
            description: allocation.description ?? dto.description ?? null,
            accountingRegisterId: register.id,
          })),
          {
            accountId: locked.accountId,
            debit: new Prisma.Decimal(0),
            credit: total,
            description: dto.description ?? null,
            accountingRegisterId: register.id,
          },
        ],
      });

      await this.assertBalancedJournal(
        tx,
        register.id,
        allocations.length + 1,
        total,
      );

      const parentName = this.formatPersonName(locked);
      return {
        id: receiptRow.id,
        nb: numbering.nb,
        parentId: locked.parentId,
        parentName,
        accountId: locked.accountId,
        accountCode: locked.accountCode ?? '',
        amount: total.toFixed(2),
        total: total.toFixed(2),
        allocations: allocations.map((allocation) => ({
          accountId: allocation.accountId,
          accountCode: allocation.accountCode,
          accountName: allocation.accountName,
          amount: allocation.amount.toFixed(2),
          description: allocation.description,
        })),
        currency: {
          id: currency.id,
          title: currency.title,
          shortCode: currency.shortCode,
          symbol: currency.symbol,
          rate: currencyRate.toString(),
        },
        currencyId: currency.id,
        currencyRate: currencyRate.toString(),
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        comments: dto.comments ?? null,
        dateCreated: register.dateCreated.toISOString(),
      };
    });
  }

  async listReceipts(
    user: AuthenticatedSchool,
    query: DashboardAccountingDocumentQueryDto,
  ): Promise<DashboardReceiptsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { schoolId: user.schoolId };

    const [total, receipts] = await this.prisma.$transaction([
      this.prisma.accountingReceipt.count({ where }),
      this.prisma.accountingReceipt.findMany({
        where,
        include: {
          accountingRegister: {
            include: {
              currency: true,
              dailyEntries: { include: { account: true } },
            },
          },
          details: { include: { account: true } },
        },
        orderBy: [{ nb: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const parentByAccountId = await this.resolveReceiptParents(
      receipts.flatMap((receipt) =>
        receipt.accountingRegister.dailyEntries.map((entry) => entry.accountId),
      ),
    );

    return {
      items: receipts.map((receipt) =>
        this.toReceiptDto(
          receipt,
          receipt.accountingRegister,
          parentByAccountId,
        ),
      ),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async getReceipt(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardReceiptDto> {
    const receipt = await this.prisma.accountingReceipt.findFirst({
      where: { id, schoolId: user.schoolId },
      include: {
        accountingRegister: {
          include: {
            currency: true,
            dailyEntries: { include: { account: true } },
          },
        },
        details: { include: { account: true } },
      },
    });
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    const parentByAccountId = await this.resolveReceiptParents(
      receipt.accountingRegister.dailyEntries.map((entry) => entry.accountId),
    );
    return this.toReceiptDto(
      receipt,
      receipt.accountingRegister,
      parentByAccountId,
    );
  }

  async createPayment(
    user: AuthenticatedSchool,
    dto: CreateDashboardPaymentDto,
  ): Promise<DashboardPaymentDto> {
    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await this.findPaymentByIdempotencyKey(
          tx,
          user.schoolId,
          dto.idempotencyKey,
        );
        if (existing) {
          return existing;
        }
      }

      const destination = await tx.account.findFirst({
        where: { id: dto.accountId, schoolId: user.schoolId },
        select: { id: true, code: true, name: true, type: true },
      });
      if (!destination) {
        throw new BadRequestException(
          'Destination account does not belong to the authenticated school',
        );
      }

      const cash = await this.ensureSystemAccount(
        tx,
        user.schoolId,
        'CASH',
        'Cash',
      );
      if (destination.id === cash.id) {
        throw new BadRequestException(
          'Destination account must be different from the Cash account',
        );
      }

      const amount = this.toDocumentAmount(dto.amount);
      const numbering = await this.nextDocumentNumber(
        tx,
        user.schoolId,
        'Payment',
      );

      let register: { id: number; dateCreated: Date };
      try {
        register = await tx.accountingRegister.create({
          data: {
            description: dto.description ?? null,
            accountingRegisterTypeId: numbering.registerTypeId,
            currencyId: dto.currencyId ?? null,
            notes: dto.notes ?? null,
            comments: dto.comments ?? null,
            currencyRate:
              dto.currencyRate === undefined
                ? null
                : new Prisma.Decimal(dto.currencyRate.toFixed(6)),
            schoolId: user.schoolId,
            idempotencyKey: dto.idempotencyKey ?? null,
          },
          select: { id: true, dateCreated: true },
        });
      } catch (error) {
        if (this.isUniqueViolation(error) && dto.idempotencyKey) {
          const existing = await this.findPaymentByIdempotencyKey(
            tx,
            user.schoolId,
            dto.idempotencyKey,
          );
          if (existing) {
            return existing;
          }
        }
        throw new ConflictException(
          'Payment could not be created because it already exists',
        );
      }

      let paymentRow: { id: number };
      try {
        paymentRow = await tx.accountingPayment.create({
          data: {
            accountingRegisterId: register.id,
            nb: numbering.nb,
            schoolId: user.schoolId,
          },
          select: { id: true },
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException(
            'Payment number is already used for this school',
          );
        }
        throw error;
      }

      await tx.accountingDaily.createMany({
        data: [
          {
            accountId: destination.id,
            debit: amount,
            credit: new Prisma.Decimal(0),
            description: dto.description ?? null,
            accountingRegisterId: register.id,
          },
          {
            accountId: cash.id,
            debit: new Prisma.Decimal(0),
            credit: amount,
            description: dto.description ?? null,
            accountingRegisterId: register.id,
          },
        ],
      });

      await this.assertBalancedJournal(tx, register.id, 2, amount);

      return {
        id: paymentRow.id,
        nb: numbering.nb,
        accountId: destination.id,
        accountCode: destination.code,
        accountName: destination.name,
        amount: amount.toFixed(2),
        currencyId: dto.currencyId ?? null,
        currencyRate:
          dto.currencyRate === undefined
            ? null
            : new Prisma.Decimal(dto.currencyRate.toFixed(6)).toString(),
        description: dto.description ?? null,
        notes: dto.notes ?? null,
        comments: dto.comments ?? null,
        dateCreated: register.dateCreated.toISOString(),
      };
    });
  }

  async listPayments(
    user: AuthenticatedSchool,
    query: DashboardAccountingDocumentQueryDto,
  ): Promise<DashboardPaymentsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = { schoolId: user.schoolId };

    const [total, payments] = await this.prisma.$transaction([
      this.prisma.accountingPayment.count({ where }),
      this.prisma.accountingPayment.findMany({
        where,
        include: {
          accountingRegister: {
            include: { dailyEntries: { include: { account: true } } },
          },
        },
        orderBy: [{ nb: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: payments.map((payment) =>
        this.toPaymentDto(payment, payment.accountingRegister),
      ),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async getPayment(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardPaymentDto> {
    const payment = await this.prisma.accountingPayment.findFirst({
      where: { id, schoolId: user.schoolId },
      include: {
        accountingRegister: {
          include: { dailyEntries: { include: { account: true } } },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.toPaymentDto(payment, payment.accountingRegister);
  }

  private async resolveAllocations(
    tx: Prisma.TransactionClient,
    schoolId: number,
    rows: Array<{ accountId: number; amount: number; description?: string }>,
  ): Promise<AllocationInput[]> {
    if (rows.length === 0) {
      throw new BadRequestException(
        'Receipt must include at least one allocation',
      );
    }
    if (rows.length > MAX_ALLOCATIONS) {
      throw new BadRequestException(
        `Receipt cannot include more than ${MAX_ALLOCATIONS} allocations`,
      );
    }
    const seen = new Set<number>();
    const allocations: AllocationInput[] = [];
    for (const row of rows) {
      if (seen.has(row.accountId)) {
        throw new BadRequestException(
          'Duplicate destination account in receipt allocations',
        );
      }
      seen.add(row.accountId);
      const destination = await tx.account.findFirst({
        where: { id: row.accountId, schoolId },
        select: { id: true, code: true, name: true, type: true },
      });
      if (!destination) {
        throw new BadRequestException(
          'Destination account does not belong to the authenticated school',
        );
      }
      if (destination.type === 'PERSON') {
        throw new BadRequestException(
          'Person accounts cannot be receipt destinations',
        );
      }
      if (!RECEIPT_DESTINATION_TYPES.has(destination.type)) {
        throw new BadRequestException(
          `Accounts of type ${destination.type} are not eligible receipt destinations`,
        );
      }
      allocations.push({
        accountId: destination.id,
        amount: this.toDocumentAmount(row.amount),
        description: row.description?.trim() ? row.description.trim() : null,
        accountCode: destination.code,
        accountName: destination.name,
      });
    }
    return allocations;
  }

  private async ensureSystemAccount(
    tx: Prisma.TransactionClient,
    schoolId: number,
    type: AccountType,
    name: string,
  ): Promise<DashboardAccountDto> {
    const existing = await tx.account.findFirst({
      where: { schoolId, type },
      select: { id: true, code: true, name: true, type: true },
    });
    if (existing) {
      return this.toAccountDto(existing, null);
    }

    const [sequence] = await tx.$queryRaw<Array<{ code: string }>>`
      SELECT nextval('"account_code_seq"')::text AS code
    `;
    if (!sequence) {
      throw new ConflictException('Could not allocate an account code');
    }

    try {
      const created = await tx.account.create({
        data: { code: sequence.code, name, type, schoolId },
        select: { id: true, code: true, name: true, type: true },
      });
      return this.toAccountDto(created, null);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const winner = await tx.account.findFirst({
          where: { schoolId, type },
          select: { id: true, code: true, name: true, type: true },
        });
        if (winner) {
          return this.toAccountDto(winner, null);
        }
      }
      throw error;
    }
  }

  private async nextDocumentNumber(
    tx: Prisma.TransactionClient,
    schoolId: number,
    registerTypeName: string,
  ): Promise<{ registerTypeId: number; nb: number }> {
    const registerType = await tx.accountingRegisterType.findUnique({
      where: { name: registerTypeName },
      select: { id: true },
    });
    if (!registerType) {
      throw new InternalServerErrorException(
        `Accounting register type "${registerTypeName}" is not configured`,
      );
    }

    const [counter] = await tx.$queryRaw<Array<{ nb: number }>>`
      INSERT INTO "accounting_document_counters"
        ("school_id", "accounting_register_type_id", "last_nb")
      VALUES (${schoolId}, ${registerType.id}, 1)
      ON CONFLICT ("school_id", "accounting_register_type_id")
      DO UPDATE SET "last_nb" = "accounting_document_counters"."last_nb" + 1
      RETURNING "last_nb" AS "nb"
    `;
    if (!counter || counter.nb < 1) {
      throw new ConflictException(
        `Could not allocate a ${registerTypeName} number`,
      );
    }

    return { registerTypeId: registerType.id, nb: counter.nb };
  }

  private async lockParentAccount(
    tx: Prisma.TransactionClient,
    schoolId: number,
    parentId: number,
  ): Promise<LockedParentAccount> {
    const [locked] = await tx.$queryRaw<Array<LockedParentAccount>>`
      SELECT
        parent.id AS "parentId",
        person.id AS "personId",
        person.account_id AS "accountId",
        person.first_name AS "firstName",
        person.middle_name AS "middleName",
        person.last_name AS "lastName",
        account.code AS "accountCode",
        account.school_id AS "accountSchoolId"
      FROM parents parent
      JOIN persons person ON person.id = parent.person_id
      LEFT JOIN accounts account ON account.id = person.account_id
      WHERE parent.id = ${parentId}
        AND person.school_id = ${schoolId}
      FOR UPDATE OF person
    `;
    if (!locked) {
      throw new NotFoundException('Parent not found');
    }
    return locked;
  }

  private async assertBalancedJournal(
    tx: Prisma.TransactionClient,
    registerId: number,
    expectedLineCount: number,
    expectedTotal: Prisma.Decimal,
  ): Promise<void> {
    const lines = await tx.accountingDaily.findMany({
      where: { accountingRegisterId: registerId },
      select: { accountId: true, debit: true, credit: true },
    });
    if (lines.length !== expectedLineCount) {
      throw new InternalServerErrorException(
        'Journal must contain exactly the posted entries',
      );
    }
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const line of lines) {
      const debit = new Prisma.Decimal(line.debit);
      const credit = new Prisma.Decimal(line.credit);
      if (debit.isNegative() || credit.isNegative()) {
        throw new InternalServerErrorException(
          'Journal entries must be non-negative',
        );
      }
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
    }
    if (
      totalDebit.isZero() ||
      !totalDebit.equals(totalCredit) ||
      !totalDebit.equals(expectedTotal)
    ) {
      throw new InternalServerErrorException('Journal is out of balance');
    }
  }

  private async findReceiptByIdempotencyKey(
    tx: Prisma.TransactionClient,
    schoolId: number,
    idempotencyKey: string,
  ): Promise<DashboardReceiptDto | null> {
    const register = await tx.accountingRegister.findFirst({
      where: { schoolId, idempotencyKey },
      include: {
        currency: true,
        receipts: { include: { details: { include: { account: true } } } },
        dailyEntries: { include: { account: true } },
      },
    });
    const receipt = register?.receipts[0];
    if (!register || !receipt || receipt.schoolId !== schoolId) {
      return null;
    }
    const parentByAccountId = await this.resolveReceiptParents(
      register.dailyEntries.map((entry) => entry.accountId),
      tx,
    );
    return this.toReceiptDto(
      { ...receipt, details: receipt.details },
      register,
      parentByAccountId,
    );
  }

  private async findPaymentByIdempotencyKey(
    tx: Prisma.TransactionClient,
    schoolId: number,
    idempotencyKey: string,
  ): Promise<DashboardPaymentDto | null> {
    const register = await tx.accountingRegister.findFirst({
      where: { schoolId, idempotencyKey },
      include: {
        payments: true,
        dailyEntries: { include: { account: true } },
      },
    });
    const payment = register?.payments[0];
    if (!register || !payment || payment.schoolId !== schoolId) {
      return null;
    }
    return this.toPaymentDto(payment, register);
  }

  private async resolveAccountPersons(
    accountIds: number[],
    client?: Prisma.TransactionClient,
  ): Promise<Map<number, { parentId: number | null; fullName: string }>> {
    const unique = [...new Set(accountIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const reader = client ?? this.prisma;
    const persons = await reader.person.findMany({
      where: { accountId: { in: unique } },
      select: {
        accountId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        parent: { select: { id: true } },
      },
    });
    const resolved = new Map<
      number,
      { parentId: number | null; fullName: string }
    >();
    for (const person of persons) {
      if (person.accountId === null) {
        continue;
      }
      resolved.set(person.accountId, {
        parentId: person.parent?.id ?? null,
        fullName: this.formatPersonName(person),
      });
    }
    return resolved;
  }

  private async resolveReceiptParents(
    accountIds: number[],
    client?: Prisma.TransactionClient,
  ): Promise<Map<number, { parentId: number; parentName: string }>> {
    const unique = [...new Set(accountIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const reader = client ?? this.prisma;
    const persons = await reader.person.findMany({
      where: { accountId: { in: unique } },
      select: {
        accountId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        parent: { select: { id: true } },
      },
    });
    const resolved = new Map<
      number,
      { parentId: number; parentName: string }
    >();
    for (const person of persons) {
      if (person.accountId === null || !person.parent) {
        continue;
      }
      resolved.set(person.accountId, {
        parentId: person.parent.id,
        parentName: this.formatPersonName(person),
      });
    }
    return resolved;
  }

  private toReceiptDto(
    receipt: { id: number; nb: number; details?: ReceiptDetailRow[] },
    register: RegisterBlock,
    parentByAccountId: Map<number, { parentId: number; parentName: string }>,
  ): DashboardReceiptDto {
    const creditLine = register.dailyEntries.find((entry) =>
      new Prisma.Decimal(entry.credit).gt(0),
    );
    if (!creditLine) {
      throw new InternalServerErrorException('Receipt journal is missing');
    }
    const parent = parentByAccountId.get(creditLine.accountId);
    if (!parent) {
      throw new InternalServerErrorException('Receipt parent is missing');
    }
    const total = new Prisma.Decimal(creditLine.credit);
    const allocations = this.toAllocationDtos(
      receipt.details ?? [],
      register.dailyEntries,
    );
    return {
      id: receipt.id,
      nb: receipt.nb,
      parentId: parent.parentId,
      parentName: parent.parentName,
      accountId: creditLine.account.id,
      accountCode: creditLine.account.code,
      amount: total.toFixed(2),
      total: total.toFixed(2),
      allocations,
      currency: this.toReceiptCurrencyDto(register.currency),
      currencyId: register.currencyId,
      currencyRate:
        register.currencyRate === null || register.currencyRate === undefined
          ? null
          : new Prisma.Decimal(register.currencyRate).toString(),
      description: register.description,
      notes: register.notes,
      comments: register.comments,
      dateCreated: register.dateCreated.toISOString(),
    };
  }

  private toAllocationDtos(
    details: ReceiptDetailRow[],
    dailyEntries: JournalLine[],
  ): DashboardReceiptAllocationDto[] {
    if (details.length > 0) {
      return details.map((detail) => ({
        accountId: detail.account.id,
        accountCode: detail.account.code,
        accountName: detail.account.name,
        amount: new Prisma.Decimal(detail.amount).toFixed(2),
        description: detail.description,
      }));
    }
    // Legacy Phase 2B receipts predate receipt details: expose the original
    // debit lines so old documents keep rendering without a backfill.
    return dailyEntries
      .filter((entry) => new Prisma.Decimal(entry.debit).gt(0))
      .map((entry) => ({
        accountId: entry.account.id,
        accountCode: entry.account.code,
        accountName: entry.account.name ?? entry.account.code,
        amount: new Prisma.Decimal(entry.debit).toFixed(2),
        description: null,
      }));
  }

  private toReceiptCurrencyDto(
    currency: RegisterBlock['currency'],
  ): DashboardReceiptCurrencyDto | null {
    if (!currency) {
      return null;
    }
    return {
      id: currency.id,
      title: currency.title,
      shortCode: currency.shortCode,
      symbol: currency.symbol,
      rate: new Prisma.Decimal(currency.rate).toString(),
    };
  }

  private toPaymentDto(
    payment: { id: number; nb: number },
    register: {
      description: string | null;
      currencyId: number | null;
      currencyRate: Prisma.Decimal | number | string | null;
      notes: string | null;
      comments: string | null;
      dateCreated: Date;
      dailyEntries: Array<{
        debit: Prisma.Decimal | number | string;
        account: { id: number; code: string; name: string };
      }>;
    },
  ): DashboardPaymentDto {
    const debitLine = register.dailyEntries.find((entry) =>
      new Prisma.Decimal(entry.debit).gt(0),
    );
    if (!debitLine) {
      throw new InternalServerErrorException('Payment journal is missing');
    }
    return {
      id: payment.id,
      nb: payment.nb,
      accountId: debitLine.account.id,
      accountCode: debitLine.account.code,
      accountName: debitLine.account.name,
      amount: new Prisma.Decimal(debitLine.debit).toFixed(2),
      currencyId: register.currencyId,
      currencyRate:
        register.currencyRate === null || register.currencyRate === undefined
          ? null
          : new Prisma.Decimal(register.currencyRate).toString(),
      description: register.description,
      notes: register.notes,
      comments: register.comments,
      dateCreated: register.dateCreated.toISOString(),
    };
  }

  private toAccountDto(
    account: AccountRow,
    relatedPerson: { parentId: number | null; fullName: string } | null,
  ): DashboardAccountDto {
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      protected: PROTECTED_ACCOUNT_TYPES.has(account.type),
      relatedPerson:
        account.type === 'PERSON'
          ? (relatedPerson ?? { parentId: null, fullName: '' })
          : null,
    };
  }

  private toDocumentAmount(value: number): Prisma.Decimal {
    const amount = new Prisma.Decimal(value.toFixed(2));
    if (amount.lte(0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    return amount;
  }

  private formatPersonName(person: {
    firstName: string;
    middleName: string;
    lastName: string;
  }): string {
    return [person.firstName, person.middleName, person.lastName]
      .filter(Boolean)
      .join(' ');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}

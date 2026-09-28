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
  CreateDashboardInvoiceDto,
  CreateDashboardPaymentDto,
  CreateDashboardReceiptDto,
  CreateDashboardRecordDto,
  CreateDashboardRegistrationInvoiceDto,
  DashboardAccountDto,
  DashboardAccountsQueryDto,
  DashboardAccountsResponseDto,
  DashboardAccountingDocumentQueryDto,
  DashboardCurrencyDto,
  DashboardInvoiceDetailBody,
  DashboardInvoiceDto,
  DashboardInvoicesQueryDto,
  DashboardInvoicesResponseDto,
  DashboardParentRegistrationDto,
  DashboardPaymentDto,
  DashboardPaymentsResponseDto,
  DashboardReceiptAllocationDto,
  DashboardReceiptCurrencyDto,
  DashboardReceiptDto,
  DashboardReceiptsResponseDto,
  DashboardRecordDto,
  DashboardRecordsResponseDto,
  DashboardRegistrationInvoiceItemBody,
  DashboardRegistrationPackagePreviewDto,
  DashboardRegistrationWithInvoiceDto,
  DashboardStatementDto,
  DashboardStatementQueryDto,
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

const PAYMENT_SOURCE_TYPES: ReadonlySet<string> = new Set(['CASH', 'GENERAL']);

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
const MAX_INVOICE_LINES = 100;
const DASHBOARD_CREATOR_PERSON_ID = 1;

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

type PaymentDetailRow = ReceiptDetailRow;

type JournalLine = {
  accountId: number;
  debit: Prisma.Decimal | number | string;
  credit: Prisma.Decimal | number | string;
  description?: string | null;
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

type InvoiceCurrencyRow = {
  id: number;
  title: string;
  shortCode: string;
  symbol: string;
  rate: Prisma.Decimal | number | string;
};

type ResolvedInvoiceLine = {
  itemId: number;
  itemName: string;
  unitPrice: Prisma.Decimal;
  quantity: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  description: string | null;
  forRegistrationId: number | null;
};

type PostedInvoiceAccount = {
  parentId: number;
  accountId: number;
  accountCode: string;
  parentName: string;
};

type PackageItemRef = {
  itemId: number;
  price: Prisma.Decimal | number | string;
  currencyId: number | null;
  mandatory: boolean;
};

type InvoiceRegistrationLabel = {
  id: number;
  studentName: string;
  className: string;
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
            dateCreated: dto.date ? new Date(dto.date) : undefined,
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
    const where: Prisma.AccountingReceiptWhereInput = {
      schoolId: user.schoolId,
      accountingRegister: this.documentRegisterFilter(query),
    };

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

  async updateReceipt(
    user: AuthenticatedSchool,
    id: number,
    dto: CreateDashboardReceiptDto,
  ): Promise<DashboardReceiptDto> {
    await this.prisma.$transaction(async (tx) => {
      const receipt = await tx.accountingReceipt.findFirst({
        where: {
          id,
          schoolId: user.schoolId,
          accountingRegister: { schoolId: user.schoolId },
        },
        select: { id: true, accountingRegisterId: true },
      });
      if (!receipt) throw new NotFoundException('Receipt not found');
      const parent = await this.lockParentAccount(
        tx,
        user.schoolId,
        dto.parentId,
      );
      if (
        parent.accountId === null ||
        parent.accountSchoolId !== user.schoolId
      ) {
        throw new BadRequestException(
          'Parent has no accounting account for this school',
        );
      }
      const currency = await tx.currency.findUnique({
        where: { id: dto.currencyId },
      });
      if (!currency) throw new BadRequestException('Invalid currency');
      const allocations = await this.resolveAllocations(
        tx,
        user.schoolId,
        dto.allocations,
      );
      const total = allocations.reduce(
        (sum, row) => sum.plus(row.amount),
        new Prisma.Decimal(0),
      );
      if (total.lte(0))
        throw new BadRequestException(
          'Receipt total must be greater than zero',
        );
      await tx.accountingRegister.update({
        where: { id: receipt.accountingRegisterId },
        data: {
          description: dto.description ?? null,
          dateCreated: dto.date ? new Date(dto.date) : undefined,
          currencyId: currency.id,
          currencyRate: new Prisma.Decimal(currency.rate),
          notes: dto.notes ?? null,
          comments: dto.comments ?? null,
        },
      });
      await tx.accountingReceiptDetail.deleteMany({
        where: { accountingReceiptId: id },
      });
      await tx.accountingDaily.deleteMany({
        where: { accountingRegisterId: receipt.accountingRegisterId },
      });
      await tx.accountingReceiptDetail.createMany({
        data: allocations.map((row) => ({
          accountingReceiptId: id,
          accountId: row.accountId,
          amount: row.amount,
          description: row.description,
        })),
      });
      await tx.accountingDaily.createMany({
        data: [
          ...allocations.map((row) => ({
            accountId: row.accountId,
            debit: row.amount,
            credit: new Prisma.Decimal(0),
            description: row.description ?? dto.description ?? null,
            accountingRegisterId: receipt.accountingRegisterId,
          })),
          {
            accountId: parent.accountId,
            debit: new Prisma.Decimal(0),
            credit: total,
            description: dto.description ?? null,
            accountingRegisterId: receipt.accountingRegisterId,
          },
        ],
      });
      await this.assertBalancedJournal(
        tx,
        receipt.accountingRegisterId,
        allocations.length + 1,
        total,
      );
    });
    return this.getReceipt(user, id);
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
      const allocations = await this.resolvePaymentAllocations(
        tx,
        user.schoolId,
        destination.id,
        dto.allocations,
      );
      const total = allocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        new Prisma.Decimal(0),
      );
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
            dateCreated: dto.date ? new Date(dto.date) : undefined,
            accountingRegisterTypeId: numbering.registerTypeId,
            currencyId: currency.id,
            notes: dto.notes ?? null,
            comments: dto.comments ?? null,
            currencyRate: new Prisma.Decimal(currency.rate),
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

      await tx.accountingPaymentDetail.createMany({
        data: allocations.map((allocation) => ({
          accountingPaymentId: paymentRow.id,
          accountId: allocation.accountId,
          amount: allocation.amount,
          description: allocation.description,
        })),
      });

      await tx.accountingDaily.createMany({
        data: [
          {
            accountId: destination.id,
            debit: total,
            credit: new Prisma.Decimal(0),
            description: dto.description ?? null,
            accountingRegisterId: register.id,
          },
          ...allocations.map((allocation) => ({
            accountId: allocation.accountId,
            debit: new Prisma.Decimal(0),
            credit: allocation.amount,
            description: allocation.description ?? dto.description ?? null,
            accountingRegisterId: register.id,
          })),
        ],
      });

      await this.assertBalancedJournal(
        tx,
        register.id,
        allocations.length + 1,
        total,
      );

      return {
        id: paymentRow.id,
        nb: numbering.nb,
        accountId: destination.id,
        accountCode: destination.code,
        accountName: destination.name,
        amount: total.toFixed(2),
        total: total.toFixed(2),
        allocations: allocations.map((allocation) => ({
          accountId: allocation.accountId,
          accountCode: allocation.accountCode,
          accountName: allocation.accountName,
          amount: allocation.amount.toFixed(2),
          description: allocation.description,
        })),
        currency: this.toReceiptCurrencyDto(currency),
        currencyId: currency.id,
        currencyRate: new Prisma.Decimal(currency.rate).toString(),
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
    const where: Prisma.AccountingPaymentWhereInput = {
      schoolId: user.schoolId,
      accountingRegister: this.documentRegisterFilter(query),
    };

    const [total, payments] = await this.prisma.$transaction([
      this.prisma.accountingPayment.count({ where }),
      this.prisma.accountingPayment.findMany({
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

    return {
      items: payments.map((payment) =>
        this.toPaymentDto(payment, payment.accountingRegister, payment.details),
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
          include: {
            currency: true,
            dailyEntries: { include: { account: true } },
          },
        },
        details: { include: { account: true } },
      },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return this.toPaymentDto(
      payment,
      payment.accountingRegister,
      payment.details,
    );
  }

  async updatePayment(
    user: AuthenticatedSchool,
    id: number,
    dto: CreateDashboardPaymentDto,
  ): Promise<DashboardPaymentDto> {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.accountingPayment.findFirst({
        where: {
          id,
          schoolId: user.schoolId,
          accountingRegister: { schoolId: user.schoolId },
        },
        select: { id: true, accountingRegisterId: true },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      const destination = await tx.account.findFirst({
        where: { id: dto.accountId, schoolId: user.schoolId },
        select: { id: true },
      });
      if (!destination)
        throw new BadRequestException(
          'Destination account does not belong to the authenticated school',
        );
      const currency = await tx.currency.findUnique({
        where: { id: dto.currencyId },
      });
      if (!currency) throw new BadRequestException('Invalid currency');
      const allocations = await this.resolvePaymentAllocations(
        tx,
        user.schoolId,
        destination.id,
        dto.allocations,
      );
      const total = allocations.reduce(
        (sum, row) => sum.plus(row.amount),
        new Prisma.Decimal(0),
      );
      await tx.accountingRegister.update({
        where: { id: payment.accountingRegisterId },
        data: {
          description: dto.description ?? null,
          dateCreated: dto.date ? new Date(dto.date) : undefined,
          currencyId: currency.id,
          currencyRate: new Prisma.Decimal(currency.rate),
          notes: dto.notes ?? null,
          comments: dto.comments ?? null,
        },
      });
      await tx.accountingPaymentDetail.deleteMany({
        where: { accountingPaymentId: id },
      });
      await tx.accountingDaily.deleteMany({
        where: { accountingRegisterId: payment.accountingRegisterId },
      });
      await tx.accountingPaymentDetail.createMany({
        data: allocations.map((row) => ({
          accountingPaymentId: id,
          accountId: row.accountId,
          amount: row.amount,
          description: row.description,
        })),
      });
      await tx.accountingDaily.createMany({
        data: [
          {
            accountId: destination.id,
            debit: total,
            credit: new Prisma.Decimal(0),
            description: dto.description ?? null,
            accountingRegisterId: payment.accountingRegisterId,
          },
          ...allocations.map((row) => ({
            accountId: row.accountId,
            debit: new Prisma.Decimal(0),
            credit: row.amount,
            description: row.description ?? dto.description ?? null,
            accountingRegisterId: payment.accountingRegisterId,
          })),
        ],
      });
      await this.assertBalancedJournal(
        tx,
        payment.accountingRegisterId,
        allocations.length + 1,
        total,
      );
    });
    return this.getPayment(user, id);
  }

  async getRegistrationPackagePreview(
    user: AuthenticatedSchool,
    classId: number,
    yearId: number,
    studentId?: number,
  ): Promise<DashboardRegistrationPackagePreviewDto> {
    const schoolId = user.schoolId;
    const classRow = await this.prisma.class.findFirst({
      where: { id: classId, stage: { schoolId } },
      select: { id: true, className: true },
    });
    if (!classRow) {
      throw new BadRequestException('Class not found for this school');
    }
    const year = await this.prisma.year.findFirst({
      where: { id: yearId, schoolId },
      select: { id: true, title: true },
    });
    if (!year) {
      throw new BadRequestException('School year not found for this school');
    }
    const registrationPackage =
      await this.prisma.accountingRegistrationPackage.findFirst({
        where: {
          yearId,
          year: { schoolId },
          classes: { some: { classId } },
        },
        select: {
          id: true,
          name: true,
          items: {
            select: {
              itemId: true,
              price: true,
              mandatory: true,
              currencyId: true,
              item: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  schoolId: true,
                  itemType: { select: { name: true } },
                },
              },
              currency: {
                select: {
                  id: true,
                  title: true,
                  shortCode: true,
                  symbol: true,
                  rate: true,
                },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      });

    let parent: DashboardRegistrationPackagePreviewDto['parent'] = null;
    if (studentId !== undefined) {
      parent = await this.previewStudentParent(schoolId, studentId);
    }

    if (!registrationPackage) {
      return {
        package: null,
        parent,
        className: classRow.className,
        yearTitle: year.title,
      };
    }
    return {
      package: {
        id: registrationPackage.id,
        name: registrationPackage.name,
        items: registrationPackage.items.map((row) => ({
          itemId: row.itemId,
          itemName: row.item.name,
          itemType: row.item.itemType.name,
          price: new Prisma.Decimal(row.price).toFixed(2),
          basePrice: new Prisma.Decimal(row.item.price).toFixed(2),
          mandatory: row.mandatory,
          currencyId: row.currencyId,
          currency: row.currency
            ? {
                id: row.currency.id,
                title: row.currency.title,
                shortCode: row.currency.shortCode,
                symbol: row.currency.symbol,
                rate: new Prisma.Decimal(row.currency.rate).toString(),
              }
            : null,
        })),
      },
      parent,
      className: classRow.className,
      yearTitle: year.title,
    };
  }

  async listParentRegistrations(
    user: AuthenticatedSchool,
    parentId: number,
  ): Promise<DashboardParentRegistrationDto[]> {
    const schoolId = user.schoolId;
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, person: { schoolId } },
      select: { id: true },
    });
    if (!parent) {
      throw new BadRequestException('Parent not found for this school');
    }
    const rows = await this.prisma.registration.findMany({
      where: {
        status: true,
        student: { parentId },
        section: { schoolId },
      },
      select: {
        id: true,
        student: {
          select: {
            id: true,
            person: {
              select: { firstName: true, middleName: true, lastName: true },
            },
          },
        },
        section: {
          select: {
            class: { select: { className: true } },
            sectionTitle: { select: { title: true } },
            year: { select: { title: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    });
    return rows.map((row) => {
      const studentName = this.formatPersonName(row.student.person);
      return {
        id: row.id,
        studentId: row.student.id,
        studentName,
        className: row.section.class.className,
        sectionTitle: row.section.sectionTitle.title,
        yearTitle: row.section.year.title,
        label: `${studentName} — ${row.section.class.className}`,
      };
    });
  }

  async listInvoices(
    user: AuthenticatedSchool,
    query: DashboardInvoicesQueryDto,
  ): Promise<DashboardInvoicesResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const registerFilter = this.documentRegisterFilter(query);
    const where: Prisma.AccountingInvoiceWhereInput = {
      schoolId: user.schoolId,
      accountingRegister:
        query.parentId !== undefined
          ? {
              AND: [
                registerFilter,
                {
                  dailyEntries: {
                    some: {
                      debit: { gt: 0 },
                      account: {
                        persons: {
                          some: { parent: { id: query.parentId } },
                        },
                      },
                    },
                  },
                },
              ],
            }
          : registerFilter,
    };

    const [total, invoices] = await this.prisma.$transaction([
      this.prisma.accountingInvoice.count({ where }),
      this.prisma.accountingInvoice.findMany({
        where,
        include: {
          accountingRegister: {
            include: {
              currency: true,
              dailyEntries: { include: { account: true } },
            },
          },
          details: {
            include: {
              item: true,
              forRegistration: {
                include: {
                  student: {
                    include: {
                      person: {
                        select: {
                          firstName: true,
                          middleName: true,
                          lastName: true,
                        },
                      },
                    },
                  },
                  section: {
                    include: {
                      class: { select: { className: true } },
                      sectionTitle: { select: { title: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ nb: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const parentByAccountId = await this.resolveAccountPersons(
      invoices.flatMap((invoice) =>
        invoice.accountingRegister.dailyEntries.map(
          (entry) => entry.accountId,
        ),
      ),
    );

    return {
      items: invoices.map((invoice) =>
        this.toInvoiceDto(invoice, invoice.accountingRegister, (accountId) => {
          const resolved = parentByAccountId.get(accountId);
          return resolved
            ? { parentId: resolved.parentId, parentName: resolved.fullName }
            : null;
        }),
      ),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async getInvoice(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardInvoiceDto> {
    const invoice = await this.prisma.accountingInvoice.findFirst({
      where: { id, schoolId: user.schoolId },
      include: {
        accountingRegister: {
          include: {
            currency: true,
            dailyEntries: { include: { account: true } },
          },
        },
        details: {
          include: {
            item: true,
            forRegistration: {
              include: {
                student: {
                  include: {
                    person: {
                      select: {
                        firstName: true,
                        middleName: true,
                        lastName: true,
                      },
                    },
                  },
                },
                section: {
                  include: {
                    class: { select: { className: true } },
                    sectionTitle: { select: { title: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const parentByAccountId = await this.resolveAccountPersons(
      invoice.accountingRegister.dailyEntries.map((entry) => entry.accountId),
    );
    return this.toInvoiceDto(
      invoice,
      invoice.accountingRegister,
      (accountId) => {
        const resolved = parentByAccountId.get(accountId);
        return resolved
          ? { parentId: resolved.parentId, parentName: resolved.fullName }
          : null;
      },
    );
  }

  async createInvoice(
    user: AuthenticatedSchool,
    dto: CreateDashboardInvoiceDto,
  ): Promise<DashboardInvoiceDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await this.findInvoiceIdByIdempotencyKey(
          tx,
          user.schoolId,
          dto.idempotencyKey,
        );
        if (existing !== null) {
          return existing;
        }
      }
      const locked = await this.lockParentAccount(
        tx,
        user.schoolId,
        dto.parentId,
      );
      const account = await this.ensureParentAccount(
        tx,
        user.schoolId,
        locked,
      );
      const currency = await this.requireCurrency(tx, dto.currencyId);
      const lines = await this.resolveInvoiceLines(tx, {
        schoolId: user.schoolId,
        parentId: locked.parentId,
        rows: dto.details,
        currencyId: currency.id,
      });
      const posted = await this.postInvoiceDocument(tx, {
        schoolId: user.schoolId,
        account,
        parentName: this.formatPersonName(locked),
        currency,
        lines,
        description: dto.description ?? null,
        date: dto.date,
        notes: dto.notes ?? null,
        comments: dto.comments ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
      });
      return posted.invoiceId;
    });
    return this.getInvoice(user, created);
  }

  async createRegistrationWithInvoice(
    user: AuthenticatedSchool,
    dto: CreateDashboardRegistrationInvoiceDto,
  ): Promise<DashboardRegistrationWithInvoiceDto> {
    await this.assertDashboardCreatorExists();
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await this.findRegistrationInvoiceByKey(
          tx,
          user.schoolId,
          dto.idempotencyKey,
        );
        if (existing) {
          return existing;
        }
      }

      const student = await tx.student.findFirst({
        where: {
          id: dto.studentId,
          person: { schoolId: user.schoolId },
        },
        select: { id: true, parentId: true },
      });
      if (!student) {
        throw new BadRequestException('Student not found');
      }
      if (student.parentId === null) {
        throw new BadRequestException(
          'Student has no parent assigned, an invoice cannot be created',
        );
      }

      const section = await tx.section.findFirst({
        where: {
          id: dto.sectionId,
          schoolId: user.schoolId,
          classId: dto.classId,
          status: 1,
        },
        select: { id: true, yearId: true },
      });
      if (!section) {
        throw new BadRequestException(
          'Section not found for the selected class',
        );
      }
      await this.assertNoActiveRegistrationForYearTx(
        tx,
        user.schoolId,
        dto.studentId,
        section.yearId,
      );

      const registrationPackage = await this.findPackageForClassTx(
        tx,
        user.schoolId,
        dto.classId,
        section.yearId,
      );
      const packageItemsByItemId = new Map(
        (registrationPackage?.items ?? []).map((row) => [row.itemId, row]),
      );
      if (registrationPackage) {
        const submittedItemIds = new Set(dto.items.map((row) => row.itemId));
        const missingMandatory = registrationPackage.items.filter(
          (row) => row.mandatory && !submittedItemIds.has(row.itemId),
        );
        if (missingMandatory.length > 0) {
          throw new BadRequestException(
            'Registration invoice is missing mandatory package items',
          );
        }
      }

      const effectiveCurrencyId = this.resolveRegistrationCurrency(
        dto.currencyId,
        registrationPackage?.items ?? [],
      );

      const account = await this.ensureParentAccountById(
        tx,
        user.schoolId,
        student.parentId,
      );
      const currency = await this.requireCurrency(tx, effectiveCurrencyId);
      const lines = await this.resolveRegistrationInvoiceLines(tx, {
        schoolId: user.schoolId,
        parentId: student.parentId,
        packageItemsByItemId,
        hasPackage: registrationPackage !== null,
        rows: dto.items,
        currencyId: currency.id,
      });
      if (lines.length === 0) {
        throw new BadRequestException('Invoice must include at least one item');
      }

      const registration = await tx.registration.create({
        data: {
          schoolId: user.schoolId,
          studentId: dto.studentId,
          sectionId: dto.sectionId,
          personId: DASHBOARD_CREATOR_PERSON_ID,
          status: true,
        },
        select: { id: true },
      });
      for (const line of lines) {
        line.forRegistrationId = registration.id;
      }

      let posted: { invoiceId: number };
      try {
        posted = await this.postInvoiceDocument(tx, {
          schoolId: user.schoolId,
          account,
          parentName: account.parentName,
          currency,
          lines,
          description: dto.description ?? registrationPackage?.name ?? null,
          date: dto.date,
          notes: dto.notes ?? null,
          comments: dto.comments ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
        });
      } catch (error) {
        if (this.isUniqueViolation(error) && dto.idempotencyKey) {
          const existing = await this.findRegistrationInvoiceByKey(
            tx,
            user.schoolId,
            dto.idempotencyKey,
          );
          if (existing) {
            return existing;
          }
        }
        throw error;
      }
      return { registrationId: registration.id, invoiceId: posted.invoiceId };
    });
    const invoice = await this.getInvoice(user, created.invoiceId);
    return { registrationId: created.registrationId, invoice };
  }

  async createRecord(
    user: AuthenticatedSchool,
    dto: CreateDashboardRecordDto,
  ): Promise<DashboardRecordDto> {
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await this.findRecordIdByIdempotencyKey(
          tx,
          user.schoolId,
          dto.idempotencyKey,
        );
        if (existing !== null) {
          return existing;
        }
      }
      if (dto.rows.length < 2 || dto.rows.length > MAX_INVOICE_LINES) {
        throw new BadRequestException(
          `Record must include 2 to ${MAX_INVOICE_LINES} journal rows`,
        );
      }
      const accountIds = [...new Set(dto.rows.map((row) => row.accountId))];
      const accounts = await tx.account.findMany({
        where: { id: { in: accountIds }, schoolId: user.schoolId },
        select: { id: true },
      });
      const foundAccountIds = new Set(accounts.map((row) => row.id));
      const missingAccountIds = accountIds.filter(
        (id) => !foundAccountIds.has(id),
      );
      if (missingAccountIds.length > 0) {
        throw new BadRequestException(
          'Record account does not belong to the authenticated school',
        );
      }
      const currency = await this.requireCurrency(tx, dto.currencyId);
      const postings = dto.rows.map((row, index) => {
        const debit = row.debit ?? 0;
        const credit = row.credit ?? 0;
        const debitAmount = new Prisma.Decimal(debit);
        const creditAmount = new Prisma.Decimal(credit);
        const hasDebit = debitAmount.gt(0);
        const hasCredit = creditAmount.gt(0);
        if (hasDebit && hasCredit) {
          throw new BadRequestException(
            `Record row ${index + 1}: debit and credit cannot both be set`,
          );
        }
        if (!hasDebit && !hasCredit) {
          throw new BadRequestException(
            `Record row ${index + 1}: debit or credit must be positive`,
          );
        }
        if (debitAmount.isNegative() || creditAmount.isNegative()) {
          throw new BadRequestException(
            `Record row ${index + 1}: amounts must not be negative`,
          );
        }
        return {
          accountId: row.accountId,
          debit: new Prisma.Decimal(debitAmount.toFixed(2)),
          credit: new Prisma.Decimal(creditAmount.toFixed(2)),
          description: row.description?.trim() ? row.description.trim() : null,
        };
      });
      const totalDebit = postings.reduce(
        (sum, row) => sum.plus(row.debit),
        new Prisma.Decimal(0),
      );
      const totalCredit = postings.reduce(
        (sum, row) => sum.plus(row.credit),
        new Prisma.Decimal(0),
      );
      if (totalDebit.lte(0) || !totalDebit.equals(totalCredit)) {
        throw new BadRequestException(
          'Record is out of balance: total debit must equal total credit and be greater than zero',
        );
      }
      const numbering = await this.nextDocumentNumber(
        tx,
        user.schoolId,
        'Record',
      );
      const currencyRate = new Prisma.Decimal(currency.rate);

      let registerId: number;
      try {
        const register = await tx.accountingRegister.create({
          data: {
            description: dto.description ?? null,
            dateCreated: dto.date ? new Date(dto.date) : undefined,
            accountingRegisterTypeId: numbering.registerTypeId,
            currencyId: currency.id,
            notes: dto.notes ?? null,
            comments: dto.comments ?? null,
            currencyRate,
            schoolId: user.schoolId,
            idempotencyKey: dto.idempotencyKey ?? null,
          },
          select: { id: true },
        });
        registerId = register.id;
      } catch (error) {
        if (this.isUniqueViolation(error) && dto.idempotencyKey) {
          const existing = await this.findRecordIdByIdempotencyKey(
            tx,
            user.schoolId,
            dto.idempotencyKey,
          );
          if (existing !== null) {
            return existing;
          }
        }
        throw new ConflictException(
          'Record could not be created because it already exists',
        );
      }

      let recordId: number;
      try {
        const created = await tx.accountingRecord.create({
          data: {
            accountingRegisterId: registerId,
            nb: numbering.nb,
            schoolId: user.schoolId,
          },
          select: { id: true },
        });
        recordId = created.id;
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException(
            'Record number is already used for this school',
          );
        }
        throw error;
      }

      await tx.accountingDaily.createMany({
        data: postings.map((row) => ({
          accountId: row.accountId,
          debit: row.debit,
          credit: row.credit,
          description: row.description ?? dto.description ?? null,
          accountingRegisterId: registerId,
        })),
      });

      await this.assertBalancedJournal(
        tx,
        registerId,
        postings.length,
        totalDebit,
      );
      return recordId;
    });
    return this.getRecord(user, created);
  }

  async listRecords(
    user: AuthenticatedSchool,
    query: DashboardAccountingDocumentQueryDto,
  ): Promise<DashboardRecordsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.AccountingRecordWhereInput = {
      schoolId: user.schoolId,
      accountingRegister: this.documentRegisterFilter(query),
    };
    const [total, records] = await this.prisma.$transaction([
      this.prisma.accountingRecord.count({ where }),
      this.prisma.accountingRecord.findMany({
        where,
        include: {
          accountingRegister: {
            include: {
              currency: true,
              dailyEntries: { include: { account: true } },
            },
          },
        },
        orderBy: [{ nb: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: records.map((record) =>
        this.toRecordDto(record, record.accountingRegister),
      ),
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async getRecord(
    user: AuthenticatedSchool,
    id: number,
  ): Promise<DashboardRecordDto> {
    const record = await this.prisma.accountingRecord.findFirst({
      where: { id, schoolId: user.schoolId },
      include: {
        accountingRegister: {
          include: {
            currency: true,
            dailyEntries: { include: { account: true } },
          },
        },
      },
    });
    if (!record) {
      throw new NotFoundException('Record not found');
    }
    return this.toRecordDto(record, record.accountingRegister);
  }

  async getAccountStatement(
    user: AuthenticatedSchool,
    accountId: number,
    query: DashboardStatementQueryDto,
  ): Promise<DashboardStatementDto> {
    const schoolId = user.schoolId;
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, schoolId },
      select: { id: true, code: true, name: true, type: true },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const documentType = query.documentType?.trim() || undefined;
    const search = query.search?.trim() || undefined;

    const openingByCurrency = new Map<string, Prisma.Decimal>();
    if (dateFrom) {
      const preRows = await this.prisma.$queryRaw<
        Array<{ currencyId: number | null; debit: unknown; credit: unknown }>
      >`
        SELECT reg."currency_id" AS "currencyId",
          COALESCE(SUM(d."debit"), 0) AS debit,
          COALESCE(SUM(d."credit"), 0) AS credit
        FROM "accounting_daily" AS d
        JOIN "accounting_register" AS reg
          ON reg."id" = d."accounting_register_id"
        WHERE d."account_id" = ${accountId}
          AND reg."school_id" = ${schoolId}
          AND reg."date_created" < ${dateFrom}
        GROUP BY reg."currency_id"
      `;
      for (const pre of preRows) {
        const key = pre.currencyId === null ? 'none' : String(pre.currencyId);
        openingByCurrency.set(
          key,
          new Prisma.Decimal(pre.credit as number | string).minus(
            new Prisma.Decimal(pre.debit as number | string),
          ),
        );
      }
    }

    const rangeRows = await this.prisma.accountingDaily.findMany({
      where: {
        accountId,
        accountingRegister: {
          schoolId,
          ...(dateFrom || dateTo
            ? {
                dateCreated: {
                  ...(dateFrom ? { gte: dateFrom } : {}),
                  ...(dateTo ? { lte: dateTo } : {}),
                },
              }
            : {}),
          ...(documentType
            ? { accountingRegisterType: { name: documentType } }
            : {}),
          ...(search
            ? { description: { contains: search, mode: 'insensitive' } }
            : {}),
        },
      },
      select: {
        id: true,
        debit: true,
        credit: true,
        description: true,
        accountingRegisterId: true,
        accountingRegister: {
          select: {
            id: true,
            dateCreated: true,
            description: true,
            currencyId: true,
            currency: true,
            accountingRegisterType: { select: { name: true } },
            receipts: { select: { id: true, nb: true }, take: 1 },
            payments: { select: { id: true, nb: true }, take: 1 },
            invoices: { select: { id: true, nb: true }, take: 1 },
            records: { select: { id: true, nb: true }, take: 1 },
          },
        },
      },
      orderBy: [
        { accountingRegister: { dateCreated: 'asc' } },
        { accountingRegisterId: 'asc' },
        { id: 'asc' },
      ],
      take: 10001,
    });
    if (rangeRows.length > 10000) {
      throw new BadRequestException(
        'Statement range is too large, narrow the date filters',
      );
    }

    const currencyKeyOf = (row: (typeof rangeRows)[number]): string =>
      row.accountingRegister.currencyId === null
        ? 'none'
        : String(row.accountingRegister.currencyId);
    const running = new Map<string, Prisma.Decimal>();
    const totals = new Map<
      string,
      {
        currencyId: number | null;
        shortCode: string;
        symbol: string;
        debit: Prisma.Decimal;
        credit: Prisma.Decimal;
      }
    >();
    const withBalance = rangeRows.map((row) => {
      const key = currencyKeyOf(row);
      const currency = row.accountingRegister.currency;
      if (!totals.has(key)) {
        totals.set(key, {
          currencyId: row.accountingRegister.currencyId,
          shortCode: currency?.shortCode ?? '—',
          symbol: currency?.symbol ?? '',
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(0),
        });
      }
      const bucket = totals.get(key);
      if (bucket) {
        bucket.debit = bucket.debit.plus(row.debit);
        bucket.credit = bucket.credit.plus(row.credit);
      }
      const before =
        running.get(key) ?? openingByCurrency.get(key) ?? new Prisma.Decimal(0);
      const after = before.plus(row.credit).minus(row.debit);
      running.set(key, after);
      return { row, balance: after };
    });

    const total = withBalance.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const pageRows = withBalance.slice((page - 1) * limit, page * limit);

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      summaries: [...totals.entries()].map(([key, bucket]) => {
        const opening = openingByCurrency.get(key) ?? new Prisma.Decimal(0);
        return {
          currencyId: bucket.currencyId ?? 0,
          shortCode: bucket.shortCode,
          symbol: bucket.symbol,
          openingBalance: opening.toFixed(2),
          totalDebit: bucket.debit.toFixed(2),
          totalCredit: bucket.credit.toFixed(2),
          closingBalance: opening.plus(bucket.credit).minus(bucket.debit).toFixed(2),
        };
      }),
      rows: pageRows.map(({ row, balance }) => {
        const info = this.statementDocumentInfo(row.accountingRegister);
        const currency = row.accountingRegister.currency;
        return {
          date: row.accountingRegister.dateCreated.toISOString(),
          documentType: info.type,
          documentNb: info.nb,
          documentId: info.id,
          documentKind: info.kind,
          description: row.description ?? row.accountingRegister.description,
          debit: new Prisma.Decimal(row.debit).toFixed(2),
          credit: new Prisma.Decimal(row.credit).toFixed(2),
          balance: balance.toFixed(2),
          currencyShortCode: currency?.shortCode ?? '—',
          currencySymbol: currency?.symbol ?? '',
        };
      }),
      page,
      limit,
      total,
      totalPages,
    };
  }

  private statementDocumentInfo(register: {
    accountingRegisterType: { name: string };
    receipts: Array<{ id: number; nb: number }>;
    payments: Array<{ id: number; nb: number }>;
    invoices: Array<{ id: number; nb: number }>;
    records: Array<{ id: number; nb: number }>;
  }): {
    type: string;
    nb: number | null;
    id: number | null;
    kind: string | null;
  } {
    const receipt = register.receipts[0];
    if (receipt) {
      return { type: 'Receipt', nb: receipt.nb, id: receipt.id, kind: 'receipts' };
    }
    const payment = register.payments[0];
    if (payment) {
      return { type: 'Payment', nb: payment.nb, id: payment.id, kind: 'payments' };
    }
    const invoice = register.invoices[0];
    if (invoice) {
      return { type: 'Invoice', nb: invoice.nb, id: invoice.id, kind: 'invoices' };
    }
    const record = register.records[0];
    if (record) {
      return { type: 'Record', nb: record.nb, id: record.id, kind: 'records' };
    }
    return { type: register.accountingRegisterType.name, nb: null, id: null, kind: null };
  }

  private async findRecordIdByIdempotencyKey(
    tx: Prisma.TransactionClient,
    schoolId: number,
    idempotencyKey: string,
  ): Promise<number | null> {
    const register = await tx.accountingRegister.findFirst({
      where: { schoolId, idempotencyKey },
      select: { records: { select: { id: true }, take: 1 } },
    });
    return register?.records[0]?.id ?? null;
  }

  private toRecordDto(
    record: { id: number; nb: number },
    register: RegisterBlock & {
      dailyEntries: Array<{
        debit: Prisma.Decimal | number | string;
        credit: Prisma.Decimal | number | string;
        account: { id: number; code: string; name: string };
        description?: string | null;
      }>;
    },
  ): DashboardRecordDto {
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    const rows = register.dailyEntries.map((entry) => {
      const debit = new Prisma.Decimal(entry.debit);
      const credit = new Prisma.Decimal(entry.credit);
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
      return {
        accountId: entry.account.id,
        accountCode: entry.account.code,
        accountName: entry.account.name ?? '',
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        description: entry.description ?? null,
      };
    });
    return {
      id: record.id,
      nb: record.nb,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      rows,
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

  private async previewStudentParent(
    schoolId: number,
    studentId: number,
  ): Promise<DashboardRegistrationPackagePreviewDto['parent']> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, person: { schoolId } },
      select: {
        parent: {
          select: {
            id: true,
            person: {
              select: {
                firstName: true,
                middleName: true,
                lastName: true,
                accountId: true,
                account: {
                  select: { id: true, code: true, schoolId: true },
                },
              },
            },
          },
        },
      },
    });
    if (!student) {
      throw new BadRequestException('Student not found');
    }
    if (!student.parent) {
      return null;
    }
    const person = student.parent.person;
    const account = person.account;
    const sameSchoolAccount =
      account && account.schoolId === schoolId ? account : null;
    return {
      parentId: student.parent.id,
      parentName: this.formatPersonName(person),
      accountId: sameSchoolAccount?.id ?? null,
      accountCode: sameSchoolAccount?.code ?? null,
      hasAccountingAccount: sameSchoolAccount !== null,
    };
  }

  private async requireCurrency(
    tx: Prisma.TransactionClient,
    currencyId: number,
  ): Promise<InvoiceCurrencyRow> {
    const currency = await tx.currency.findUnique({
      where: { id: currencyId },
      select: { id: true, title: true, shortCode: true, symbol: true, rate: true },
    });
    if (!currency) {
      throw new BadRequestException('Invalid currency');
    }
    return currency;
  }

  private async ensureParentAccount(
    tx: Prisma.TransactionClient,
    schoolId: number,
    locked: LockedParentAccount,
  ): Promise<PostedInvoiceAccount> {
    const parentName = this.formatPersonName(locked);
    if (locked.accountId !== null) {
      if (locked.accountSchoolId !== schoolId) {
        throw new ConflictException(
          'Parent account does not belong to the authenticated school',
        );
      }
      return {
        parentId: locked.parentId,
        accountId: locked.accountId,
        accountCode: locked.accountCode ?? '',
        parentName,
      };
    }
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
          name: parentName,
          type: 'PERSON',
          schoolId,
        },
        select: { id: true, code: true },
      });
      await tx.person.update({
        where: { id: locked.personId },
        data: { accountId: created.id },
      });
      return {
        parentId: locked.parentId,
        accountId: created.id,
        accountCode: created.code,
        parentName,
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const winner = await tx.person.findUnique({
          where: { id: locked.personId },
          select: {
            accountId: true,
            account: { select: { id: true, code: true, schoolId: true } },
          },
        });
        if (
          winner?.accountId !== null &&
          winner?.accountId !== undefined &&
          winner.account?.schoolId === schoolId
        ) {
          return {
            parentId: locked.parentId,
            accountId: winner.accountId,
            accountCode: winner.account?.code ?? '',
            parentName,
          };
        }
      }
      throw error;
    }
  }

  private async ensureParentAccountById(
    tx: Prisma.TransactionClient,
    schoolId: number,
    parentId: number,
  ): Promise<PostedInvoiceAccount> {
    const locked = await this.lockParentAccount(tx, schoolId, parentId);
    return this.ensureParentAccount(tx, schoolId, locked);
  }

  private lineTotalOf(
    unitPrice: Prisma.Decimal,
    quantity: Prisma.Decimal,
    discount: Prisma.Decimal,
    tax: Prisma.Decimal,
  ): Prisma.Decimal {
    const total = new Prisma.Decimal(unitPrice)
      .times(quantity)
      .minus(discount)
      .plus(tax);
    const rounded = new Prisma.Decimal(total.toFixed(2));
    if (rounded.lte(0)) {
      throw new BadRequestException('Invoice line total must be positive');
    }
    return rounded;
  }

  private async resolveInvoiceLines(
    tx: Prisma.TransactionClient,
    args: {
      schoolId: number;
      parentId: number;
      rows: DashboardInvoiceDetailBody[];
      currencyId: number;
    },
  ): Promise<ResolvedInvoiceLine[]> {
    if (args.rows.length === 0 || args.rows.length > MAX_INVOICE_LINES) {
      throw new BadRequestException(
        `Invoice must include 1 to ${MAX_INVOICE_LINES} lines`,
      );
    }
    const forRegistrationIds = [
      ...new Set(
        args.rows
          .map((row) => row.forRegistrationId)
          .filter((id): id is number => id !== undefined),
      ),
    ];
    const registrationById = await this.requireParentRegistrations(
      tx,
      args.schoolId,
      args.parentId,
      forRegistrationIds,
    );
    void registrationById;
    const itemIds = args.rows.map((row) => row.itemId);
    const items = await tx.item.findMany({
      where: { id: { in: itemIds }, schoolId: args.schoolId },
      select: { id: true, name: true, price: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));
    return args.rows.map((row, index) => {
      const item = itemById.get(row.itemId);
      if (!item) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: item does not belong to the authenticated school`,
        );
      }
      const quantity =
        row.quantity === undefined
          ? new Prisma.Decimal(1)
          : new Prisma.Decimal(row.quantity);
      if (quantity.lte(0)) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: quantity must be greater than zero`,
        );
      }
      const unitPrice =
        row.unitPrice === undefined
          ? new Prisma.Decimal(item.price)
          : new Prisma.Decimal(row.unitPrice);
      if (unitPrice.lte(0)) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: price must be greater than zero`,
        );
      }
      return {
        itemId: item.id,
        itemName: item.name,
        unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
        quantity: new Prisma.Decimal(quantity.toFixed(3)),
        lineTotal: this.lineTotalOf(
          new Prisma.Decimal(unitPrice.toFixed(2)),
          new Prisma.Decimal(quantity.toFixed(3)),
          new Prisma.Decimal(0),
          new Prisma.Decimal(0),
        ),
        description: row.description?.trim() ? row.description.trim() : null,
        forRegistrationId: row.forRegistrationId ?? null,
      };
    });
  }

  private async resolveRegistrationInvoiceLines(
    tx: Prisma.TransactionClient,
    args: {
      schoolId: number;
      parentId: number;
      packageItemsByItemId: Map<number, PackageItemRef>;
      hasPackage: boolean;
      rows: DashboardRegistrationInvoiceItemBody[];
      currencyId: number;
    },
  ): Promise<ResolvedInvoiceLine[]> {
    if (args.rows.length === 0 || args.rows.length > MAX_INVOICE_LINES) {
      throw new BadRequestException(
        `Invoice must include 1 to ${MAX_INVOICE_LINES} lines`,
      );
    }
    const itemIds = args.rows.map((row) => row.itemId);
    const items = await tx.item.findMany({
      where: { id: { in: itemIds }, schoolId: args.schoolId },
      select: { id: true, name: true, price: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));
    return args.rows.map((row, index) => {
      const item = itemById.get(row.itemId);
      if (!item) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: item does not belong to the authenticated school`,
        );
      }
      const packageRef = args.packageItemsByItemId.get(row.itemId);
      if (args.hasPackage && !packageRef) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: item is not part of the class registration package`,
        );
      }
      if (packageRef?.currencyId != null && packageRef.currencyId !== args.currencyId) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: package item currency does not match the invoice currency`,
        );
      }
      const quantity =
        row.quantity === undefined
          ? new Prisma.Decimal(1)
          : new Prisma.Decimal(row.quantity);
      if (quantity.lte(0)) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: quantity must be greater than zero`,
        );
      }
      const fallback =
        packageRef !== undefined
          ? new Prisma.Decimal(packageRef.price)
          : new Prisma.Decimal(item.price);
      const unitPrice =
        row.unitPrice === undefined
          ? fallback
          : new Prisma.Decimal(row.unitPrice);
      if (unitPrice.lte(0)) {
        throw new BadRequestException(
          `Invoice line ${index + 1}: price must be greater than zero`,
        );
      }
      return {
        itemId: item.id,
        itemName: item.name,
        unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
        quantity: new Prisma.Decimal(quantity.toFixed(3)),
        lineTotal: this.lineTotalOf(
          new Prisma.Decimal(unitPrice.toFixed(2)),
          new Prisma.Decimal(quantity.toFixed(3)),
          new Prisma.Decimal(0),
          new Prisma.Decimal(0),
        ),
        description: row.description?.trim() ? row.description.trim() : null,
        forRegistrationId: null,
      };
    });
  }

  private resolveRegistrationCurrency(
    requested: number | undefined,
    packageItems: PackageItemRef[],
  ): number {
    const distinct = [
      ...new Set(
        packageItems
          .map((row) => row.currencyId)
          .filter((id): id is number => id !== null),
      ),
    ];
    if (requested !== undefined) {
      const mismatch = distinct.some((id) => id !== requested);
      if (mismatch) {
        throw new BadRequestException(
          'Package items use different currencies, one invoice cannot mix them',
        );
      }
      return requested;
    }
    if (distinct.length === 1) {
      return distinct[0];
    }
    if (distinct.length > 1) {
      throw new BadRequestException(
        'Package items use different currencies, select a single invoice currency first',
      );
    }
    throw new BadRequestException('Select an invoice currency first');
  }

  private async requireParentRegistrations(
    tx: Prisma.TransactionClient,
    schoolId: number,
    parentId: number,
    registrationIds: number[],
  ): Promise<Map<number, InvoiceRegistrationLabel>> {
    const labels = new Map<number, InvoiceRegistrationLabel>();
    if (registrationIds.length === 0) {
      return labels;
    }
    const rows = await tx.registration.findMany({
      where: { id: { in: registrationIds } },
      select: {
        id: true,
        student: {
          select: {
            parentId: true,
            person: {
              select: { firstName: true, middleName: true, lastName: true },
            },
          },
        },
        section: {
          select: {
            schoolId: true,
            class: { select: { className: true } },
          },
        },
      },
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));
    for (const id of registrationIds) {
      const row = rowById.get(id);
      if (
        !row ||
        row.student.parentId !== parentId ||
        row.section.schoolId !== schoolId
      ) {
        throw new BadRequestException(
          `Registration ${id} does not belong to this parent and school`,
        );
      }
      labels.set(id, {
        id: row.id,
        studentName: this.formatPersonName(row.student.person),
        className: row.section.class.className,
      });
    }
    return labels;
  }

  private async findPackageForClassTx(
    tx: Prisma.TransactionClient,
    schoolId: number,
    classId: number,
    yearId: number,
  ): Promise<{ id: number; name: string; items: PackageItemRef[] } | null> {
    const registrationPackage = await tx.accountingRegistrationPackage.findFirst({
      where: {
        yearId,
        year: { schoolId },
        classes: { some: { classId } },
      },
      select: {
        id: true,
        name: true,
        items: {
          select: { itemId: true, price: true, currencyId: true, mandatory: true },
        },
      },
    });
    return registrationPackage;
  }

  private async assertNoActiveRegistrationForYearTx(
    tx: Prisma.TransactionClient,
    schoolId: number,
    studentId: number,
    yearId: number,
  ): Promise<void> {
    const existing = await tx.registration.findFirst({
      where: {
        studentId,
        status: true,
        section: { schoolId, yearId },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'This student already has a registration for this year. One student can only have one registration per year.',
      );
    }
  }

  private async assertDashboardCreatorExists(): Promise<void> {
    const person = await this.prisma.person.findUnique({
      where: { id: DASHBOARD_CREATOR_PERSON_ID },
      select: { id: true },
    });
    if (!person) {
      throw new BadRequestException('Creator person not found');
    }
  }

  private async postInvoiceDocument(
    tx: Prisma.TransactionClient,
    args: {
      schoolId: number;
      account: PostedInvoiceAccount;
      parentName: string;
      currency: InvoiceCurrencyRow;
      lines: ResolvedInvoiceLine[];
      description: string | null;
      date?: string;
      notes: string | null;
      comments: string | null;
      idempotencyKey: string | null;
    },
  ): Promise<{ invoiceId: number; nb: number }> {
    const total = args.lines.reduce(
      (sum, line) => sum.plus(line.lineTotal),
      new Prisma.Decimal(0),
    );
    if (total.lte(0)) {
      throw new BadRequestException('Invoice total must be greater than zero');
    }
    const sales = await this.ensureSystemAccount(
      tx,
      args.schoolId,
      'SALES',
      'Sales',
    );
    const numbering = await this.nextDocumentNumber(
      tx,
      args.schoolId,
      'Invoice',
    );
    const currencyRate = new Prisma.Decimal(args.currency.rate);

    let registerId: number;
    try {
      const register = await tx.accountingRegister.create({
        data: {
          description: args.description,
          dateCreated: args.date ? new Date(args.date) : undefined,
          accountingRegisterTypeId: numbering.registerTypeId,
          currencyId: args.currency.id,
          notes: args.notes,
          comments: args.comments,
          currencyRate,
          schoolId: args.schoolId,
          idempotencyKey: args.idempotencyKey,
        },
        select: { id: true },
      });
      registerId = register.id;
    } catch (error) {
      if (this.isUniqueViolation(error) && args.idempotencyKey) {
        const existing = await this.findInvoiceIdByIdempotencyKey(
          tx,
          args.schoolId,
          args.idempotencyKey,
        );
        if (existing !== null) {
          const invoice = await tx.accountingInvoice.findFirst({
            where: { id: existing, schoolId: args.schoolId },
            select: { id: true, nb: true },
          });
          if (invoice) {
            return { invoiceId: invoice.id, nb: invoice.nb };
          }
        }
      }
      throw new ConflictException(
        'Invoice could not be created because it already exists',
      );
    }

    let invoiceId: number;
    try {
      const created = await tx.accountingInvoice.create({
        data: {
          dateCreated: args.date ? new Date(args.date) : undefined,
          description: args.description,
          accountingRegisterId: registerId,
          nb: numbering.nb,
          schoolId: args.schoolId,
          tax: new Prisma.Decimal(0),
          discount: new Prisma.Decimal(0),
          total,
        },
        select: { id: true },
      });
      invoiceId = created.id;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Invoice number is already used for this school',
        );
      }
      throw error;
    }

    await tx.accountingInvoiceDetail.createMany({
      data: args.lines.map((line) => ({
        invoiceId,
        itemId: line.itemId,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        description: line.description,
        discount: new Prisma.Decimal(0),
        tax: new Prisma.Decimal(0),
        forRegistrationId: line.forRegistrationId,
      })),
    });

    await tx.accountingDaily.createMany({
      data: [
        {
          accountId: args.account.accountId,
          debit: total,
          credit: new Prisma.Decimal(0),
          description: args.description,
          accountingRegisterId: registerId,
        },
        {
          accountId: sales.id,
          debit: new Prisma.Decimal(0),
          credit: total,
          description: args.description,
          accountingRegisterId: registerId,
        },
      ],
    });

    await this.assertBalancedJournal(tx, registerId, 2, total);
    return { invoiceId, nb: numbering.nb };
  }

  private async findInvoiceIdByIdempotencyKey(
    tx: Prisma.TransactionClient,
    schoolId: number,
    idempotencyKey: string,
  ): Promise<number | null> {
    const register = await tx.accountingRegister.findFirst({
      where: { schoolId, idempotencyKey },
      select: { invoices: { select: { id: true }, take: 1 } },
    });
    return register?.invoices[0]?.id ?? null;
  }

  private async findRegistrationInvoiceByKey(
    tx: Prisma.TransactionClient,
    schoolId: number,
    idempotencyKey: string,
  ): Promise<{ registrationId: number; invoiceId: number } | null> {
    const register = await tx.accountingRegister.findFirst({
      where: { schoolId, idempotencyKey },
      select: {
        invoices: {
          select: {
            id: true,
            details: { select: { forRegistrationId: true } },
          },
          take: 1,
        },
      },
    });
    const invoice = register?.invoices[0];
    if (!invoice) {
      return null;
    }
    const registrationId = invoice.details.find(
      (detail) => detail.forRegistrationId !== null,
    )?.forRegistrationId;
    if (registrationId === undefined || registrationId === null) {
      throw new ConflictException(
        'Duplicate submission detected for a different invoice',
      );
    }
    return { registrationId, invoiceId: invoice.id };
  }

  private toInvoiceDto(
    invoice: {
      id: number;
      nb: number;
      description: string | null;
      dateCreated: Date;
      details: Array<{
        id: number;
        itemId: number;
        unitPrice: Prisma.Decimal | number | string;
        quantity: Prisma.Decimal | number | string;
        description: string | null;
        discount: Prisma.Decimal | number | string;
        tax: Prisma.Decimal | number | string;
        item: { id: number; name: string };
        forRegistrationId: number | null;
        forRegistration?: {
          id: number;
          student: {
            person: { firstName: string; middleName: string; lastName: string };
          };
          section: {
            class: { className: string };
            sectionTitle: { title: string };
          };
        } | null;
      }>;
    },
    register: RegisterBlock,
    resolveParent: (
      accountId: number,
    ) => { parentId: number | null; parentName: string } | null,
  ): DashboardInvoiceDto {
    const debitLine = register.dailyEntries.find((entry) =>
      new Prisma.Decimal(entry.debit).gt(0),
    );
    if (!debitLine) {
      throw new InternalServerErrorException('Invoice journal is missing');
    }
    const parent = resolveParent(debitLine.accountId);
    if (!parent || parent.parentId === null) {
      throw new InternalServerErrorException('Invoice parent is missing');
    }
    const total = new Prisma.Decimal(debitLine.debit);
    return {
      id: invoice.id,
      nb: invoice.nb,
      parentId: parent.parentId,
      parentName: parent.parentName,
      accountId: debitLine.account.id,
      accountCode: debitLine.account.code,
      total: total.toFixed(2),
      details: invoice.details.map((detail) => {
        const forRegistration = detail.forRegistration;
        const label = forRegistration
          ? `${this.formatPersonName(forRegistration.student.person)} — ${forRegistration.section.class.className}`
          : null;
        const lineTotal = new Prisma.Decimal(detail.unitPrice)
          .times(detail.quantity)
          .minus(detail.discount)
          .plus(detail.tax);
        return {
          id: detail.id,
          itemId: detail.itemId,
          itemName: detail.item.name,
          unitPrice: new Prisma.Decimal(detail.unitPrice).toFixed(2),
          quantity: new Prisma.Decimal(detail.quantity).toFixed(3),
          lineTotal: lineTotal.toFixed(2),
          description: detail.description,
          forRegistrationId: detail.forRegistrationId,
          forRegistrationLabel: label,
        };
      }),
      currency: this.toReceiptCurrencyDto(register.currency),
      currencyId: register.currencyId,
      currencyRate:
        register.currencyRate === null || register.currencyRate === undefined
          ? null
          : new Prisma.Decimal(register.currencyRate).toString(),
      description: invoice.description,
      dateCreated: invoice.dateCreated.toISOString(),
    };
  }

  private async resolvePaymentAllocations(
    tx: Prisma.TransactionClient,
    schoolId: number,
    destinationId: number,
    rows: Array<{ accountId: number; amount: number; description?: string }>,
  ): Promise<AllocationInput[]> {
    if (rows.length === 0 || rows.length > MAX_ALLOCATIONS) {
      throw new BadRequestException('Payment must include 1 to 50 allocations');
    }
    const accountIds = rows.map((row) => row.accountId);
    if (new Set(accountIds).size !== accountIds.length) {
      throw new BadRequestException(
        'Duplicate source account in payment allocations',
      );
    }
    if (accountIds.includes(destinationId)) {
      throw new BadRequestException(
        'Payment destination cannot also be a funding source',
      );
    }
    const accounts = await tx.account.findMany({
      where: { id: { in: accountIds }, schoolId },
      select: { id: true, code: true, name: true, type: true },
    });
    const accountById = new Map(
      accounts.map((account) => [account.id, account]),
    );
    return rows.map((row) => {
      const account = accountById.get(row.accountId);
      if (!account) {
        throw new BadRequestException(
          'Funding account does not belong to the authenticated school',
        );
      }
      if (!PAYMENT_SOURCE_TYPES.has(account.type)) {
        throw new BadRequestException(
          `Accounts of type ${account.type} cannot fund payments`,
        );
      }
      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        amount: this.toDocumentAmount(row.amount),
        description: row.description?.trim() || null,
      };
    });
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
        currency: true,
        payments: { include: { details: { include: { account: true } } } },
        dailyEntries: { include: { account: true } },
      },
    });
    const payment = register?.payments[0];
    if (!register || !payment || payment.schoolId !== schoolId) {
      return null;
    }
    return this.toPaymentDto(payment, register, payment.details);
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
      currency?: RegisterBlock['currency'];
      dailyEntries: Array<{
        debit: Prisma.Decimal | number | string;
        credit: Prisma.Decimal | number | string;
        account: { id: number; code: string; name: string };
      }>;
    },
    details: PaymentDetailRow[] = [],
  ): DashboardPaymentDto {
    const debitLine = register.dailyEntries.find((entry) =>
      new Prisma.Decimal(entry.debit).gt(0),
    );
    if (!debitLine) {
      throw new InternalServerErrorException('Payment journal is missing');
    }
    const total = new Prisma.Decimal(debitLine.debit);
    const allocations =
      details.length > 0
        ? details.map((detail) => ({
            accountId: detail.account.id,
            accountCode: detail.account.code,
            accountName: detail.account.name,
            amount: new Prisma.Decimal(detail.amount).toFixed(2),
            description: detail.description,
          }))
        : register.dailyEntries
            .filter((entry) => new Prisma.Decimal(entry.credit).gt(0))
            .map((entry) => ({
              accountId: entry.account.id,
              accountCode: entry.account.code,
              accountName: entry.account.name,
              amount: new Prisma.Decimal(entry.credit).toFixed(2),
              description: null,
            }));
    return {
      id: payment.id,
      nb: payment.nb,
      accountId: debitLine.account.id,
      accountCode: debitLine.account.code,
      accountName: debitLine.account.name,
      amount: total.toFixed(2),
      total: total.toFixed(2),
      allocations,
      currency: this.toReceiptCurrencyDto(register.currency ?? null),
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

  private documentRegisterFilter(
    query: DashboardAccountingDocumentQueryDto,
  ): Prisma.AccountingRegisterWhereInput {
    const filter: Prisma.AccountingRegisterWhereInput = {};
    if (query.currencyId) {
      filter.currencyId = query.currencyId;
    }
    if (query.search) {
      filter.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        {
          dailyEntries: {
            some: {
              account: {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { code: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }
    if (query.dateFrom || query.dateTo) {
      filter.dateCreated = {
        gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
        lte: query.dateTo
          ? new Date(`${query.dateTo}T23:59:59.999Z`)
          : undefined,
      };
    }
    return filter;
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

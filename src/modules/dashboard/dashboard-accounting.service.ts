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
  CreateDashboardPaymentDto,
  CreateDashboardReceiptDto,
  DashboardAccountDto,
  DashboardAccountingDocumentQueryDto,
  DashboardPaymentDto,
  DashboardPaymentsResponseDto,
  DashboardReceiptDto,
  DashboardReceiptsResponseDto,
} from './dto/dashboard-accounting.dto';

const SYSTEM_ACCOUNT_DEFINITIONS: Array<{ type: AccountType; name: string }> = [
  { type: 'CASH', name: 'Cash' },
  { type: 'SALES', name: 'Sales' },
  { type: 'PURCHASES', name: 'Purchases' },
];

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

@Injectable()
export class DashboardAccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(
    user: AuthenticatedSchool,
  ): Promise<DashboardAccountDto[]> {
    const accounts = await this.prisma.account.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, code: true, name: true, type: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
    });
    return accounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
    }));
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

      const cash = await this.ensureSystemAccount(
        tx,
        user.schoolId,
        'CASH',
        'Cash',
      );
      const amount = this.toDocumentAmount(dto.amount);
      const numbering = await this.nextDocumentNumber(
        tx,
        user.schoolId,
        'Receipt',
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

      await tx.accountingDaily.createMany({
        data: [
          {
            accountId: cash.id,
            debit: amount,
            credit: new Prisma.Decimal(0),
            description: dto.description ?? null,
            accountingRegisterId: register.id,
          },
          {
            accountId: locked.accountId,
            debit: new Prisma.Decimal(0),
            credit: amount,
            description: dto.description ?? null,
            accountingRegisterId: register.id,
          },
        ],
      });

      await this.assertBalancedJournal(tx, register.id, [
        cash.id,
        locked.accountId,
      ]);

      return {
        id: receiptRow.id,
        nb: numbering.nb,
        parentId: locked.parentId,
        parentName: this.formatPersonName(locked),
        accountId: locked.accountId,
        accountCode: locked.accountCode ?? '',
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
            include: { dailyEntries: { include: { account: true } } },
          },
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
          include: { dailyEntries: { include: { account: true } } },
        },
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

      await this.assertBalancedJournal(tx, register.id, [
        destination.id,
        cash.id,
      ]);

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
      return this.toAccountDto(existing);
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
      return this.toAccountDto(created);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const winner = await tx.account.findFirst({
          where: { schoolId, type },
          select: { id: true, code: true, name: true, type: true },
        });
        if (winner) {
          return this.toAccountDto(winner);
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
    expectedAccountIds: number[],
  ): Promise<void> {
    const lines = await tx.accountingDaily.findMany({
      where: { accountingRegisterId: registerId },
      select: { accountId: true, debit: true, credit: true },
    });
    if (lines.length !== 2) {
      throw new InternalServerErrorException(
        'Journal must contain exactly two entries',
      );
    }
    const actual = [...lines.map((line) => line.accountId)].sort();
    const expected = [...expectedAccountIds].sort();
    if (actual[0] !== expected[0] || actual[1] !== expected[1]) {
      throw new InternalServerErrorException(
        'Journal entries reference unexpected accounts',
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
    if (totalDebit.isZero() || !totalDebit.equals(totalCredit)) {
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
        receipts: true,
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
    return this.toReceiptDto(receipt, register, parentByAccountId);
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
    receipt: { id: number; nb: number },
    register: {
      description: string | null;
      currencyId: number | null;
      currencyRate: Prisma.Decimal | number | string | null;
      notes: string | null;
      comments: string | null;
      dateCreated: Date;
      dailyEntries: Array<{
        accountId: number;
        debit: Prisma.Decimal | number | string;
        credit: Prisma.Decimal | number | string;
        account: { id: number; code: string };
      }>;
    },
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
    const amount = new Prisma.Decimal(creditLine.credit);
    return {
      id: receipt.id,
      nb: receipt.nb,
      parentId: parent.parentId,
      parentName: parent.parentName,
      accountId: creditLine.account.id,
      accountCode: creditLine.account.code,
      amount: amount.toFixed(2),
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

  private toAccountDto(account: {
    id: number;
    code: string;
    name: string;
    type: AccountType;
  }): DashboardAccountDto {
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export class DashboardAccountDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '100001' })
  code!: string;

  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  name!: string;

  @ApiProperty({
    example: 'PERSON',
    enum: ['PERSON', 'CASH', 'SALES', 'PURCHASES', 'GENERAL'],
  })
  type!: string;

  @ApiProperty({ example: false })
  protected!: boolean;

  @ApiProperty({
    example: null,
    nullable: true,
    description:
      'Hierarchy parent account id (accounts.id). NULL = root account.',
  })
  parentId!: number | null;

  @ApiProperty({
    example: false,
    description:
      'GROUP accounts organize the chart and cannot receive journal postings.',
  })
  isGroup!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether this account has direct children in the chart.',
  })
  hasChildren!: boolean;

  @ApiProperty({ type: () => DashboardAccountRelatedPersonDto, nullable: true })
  relatedPerson!: DashboardAccountRelatedPersonDto | null;
}

export class DashboardAccountRelatedPersonDto {
  @ApiProperty({ example: 7, nullable: true })
  parentId!: number | null;

  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  fullName!: string;
}

export class DashboardCurrencyDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'US Dollar' })
  title!: string;

  @ApiProperty({ example: 'USD' })
  shortCode!: string;

  @ApiProperty({ example: '$' })
  symbol!: string;

  @ApiProperty({ example: '1' })
  rate!: string;
}

export class DashboardAccountsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: '100001' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    example: 'GENERAL',
    enum: ['PERSON', 'CASH', 'SALES', 'PURCHASES', 'GENERAL'],
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsIn(['PERSON', 'CASH', 'SALES', 'PURCHASES', 'GENERAL'])
  type?: string;
}

export class DashboardAccountsResponseDto {
  @ApiProperty({ type: [DashboardAccountDto] })
  items!: DashboardAccountDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class CreateDashboardAccountDto {
  @ApiProperty({ example: 'Bank Audi' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    example: 'GENERAL',
    description:
      'GENERAL accounts can be created anywhere in the chart. PERSON accounts can only be created as children of the 4111 customer branch.',
    enum: ['GENERAL', 'PERSON'],
  })
  @IsIn(['GENERAL', 'PERSON'])
  type!: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description:
      'Hierarchy parent account id (accounts.id). Omit/NULL for a root account. The selected tree node determines this value; it is never typed manually.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parentId?: number;

  @ApiPropertyOptional({
    example: '41',
    description:
      'Explicit structural code for group-hierarchy levels (e.g. 40, 41, 411). Ignored for PERSON leaves under 4111, which are always allocated by the backend.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  code?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'GROUP accounts organize the chart and cannot receive journal postings. PERSON leaves are always posting accounts.',
  })
  @IsOptional()
  @Type(() => Boolean)
  isGroup?: boolean;
}

export class UpdateDashboardAccountDto {
  @ApiPropertyOptional({ example: 'Bank Audi Main Branch' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Toggle GROUP/POSTING designation. A group with children cannot become a posting account.',
  })
  @IsOptional()
  @Type(() => Boolean)
  isGroup?: boolean;
}

export class DashboardAccountNextCodeDto {
  @ApiProperty({ example: 53 })
  parentId!: number;

  @ApiProperty({ example: '4111' })
  parentCode!: string;

  @ApiProperty({ example: 'Ordinary customers' })
  parentName!: string;

  @ApiProperty({
    example: '41110004',
    nullable: true,
    description:
      'Read-only preview of the next child code. NULL when the branch uses manually defined structural codes.',
  })
  expectedCode!: string | null;

  @ApiProperty({
    example: true,
    description:
      'Whether the backend allocates the child code automatically (4111 PERSON leaves).',
  })
  autoAllocatable!: boolean;

  @ApiProperty({
    example: 2,
    nullable: true,
    description:
      'Exact required digit length for a direct child code (parent length 1->2, 2->3, 3->4, 4->8). NULL when the parent cannot have children.',
  })
  requiredLength!: number | null;
}

export class DashboardAccountingDocumentQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'cash' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  currencyId?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

class DashboardAccountingDocumentBody {
  @ApiPropertyOptional({ example: '2026-09-28' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsPositive()
  currencyRate?: number;

  @ApiPropertyOptional({ example: 'Tuition installment' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({ example: 'Paid in cash at the office' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ example: 'Second installment' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  comments?: string;

  @ApiPropertyOptional({
    description:
      'Client-generated idempotency key (UUID v4). Retries reuse the same key so double submits return the original document instead of creating a duplicate.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID('4')
  idempotencyKey?: string;
}

export class DashboardReceiptAllocationBody {
  @ApiProperty({
    example: 31,
    description: 'Destination account owned by the school (CASH or GENERAL)',
  })
  @Type(() => Number)
  @IsInt()
  accountId!: number;

  @ApiProperty({ example: 500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'Cash payment' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string;
}

export class CreateDashboardReceiptDto extends DashboardAccountingDocumentBody {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  parentId!: number;

  @ApiProperty({
    example: 1,
    description:
      'Currency of the receipt. The posting rate is taken from the currency record.',
  })
  @Type(() => Number)
  @IsInt()
  currencyId!: number;

  @ApiProperty({
    type: [DashboardReceiptAllocationBody],
    description:
      'One or more destination allocations. Backend posts one debit row per allocation and a single parent credit for the total.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DashboardReceiptAllocationBody)
  allocations!: DashboardReceiptAllocationBody[];
}

export class CreateDashboardPaymentDto extends DashboardAccountingDocumentBody {
  @ApiProperty({
    example: 5,
    description: 'Destination accounting account owned by the school',
  })
  @Type(() => Number)
  @IsInt()
  accountId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  currencyId!: number;

  @ApiProperty({ type: [DashboardReceiptAllocationBody] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DashboardReceiptAllocationBody)
  allocations!: DashboardReceiptAllocationBody[];
}

export class DashboardReceiptAllocationDto {
  @ApiProperty({ example: 31 })
  accountId!: number;

  @ApiProperty({ example: '200001' })
  accountCode!: string;

  @ApiProperty({ example: 'Cash' })
  accountName!: string;

  @ApiProperty({ example: '500.00' })
  amount!: string;

  @ApiProperty({ example: 'Cash payment', nullable: true })
  description!: string | null;
}

export class DashboardReceiptCurrencyDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'US Dollar' })
  title!: string;

  @ApiProperty({ example: 'USD' })
  shortCode!: string;

  @ApiProperty({ example: '$' })
  symbol!: string;

  @ApiProperty({ example: '1' })
  rate!: string;
}

export class DashboardReceiptDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  nb!: number;

  @ApiProperty({ example: 7 })
  parentId!: number;

  @ApiProperty({ example: 'Ahmad Hassan Khalil' })
  parentName!: string;

  @ApiProperty({ example: 12 })
  accountId!: number;

  @ApiProperty({ example: '100001' })
  accountCode!: string;

  @ApiProperty({ example: '123.45' })
  amount!: string;

  @ApiProperty({
    type: [DashboardReceiptAllocationDto],
    description:
      'Destination allocations. Legacy Phase 2B receipts without detail rows expose the original debit lines here.',
  })
  allocations!: DashboardReceiptAllocationDto[];

  @ApiProperty({ example: '150.00' })
  total!: string;

  @ApiProperty({ type: () => DashboardReceiptCurrencyDto, nullable: true })
  currency!: DashboardReceiptCurrencyDto | null;

  @ApiProperty({ example: 1, nullable: true })
  currencyId!: number | null;

  @ApiProperty({ example: '1', nullable: true })
  currencyRate!: string | null;

  @ApiProperty({ example: 'Tuition installment', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'Paid in cash at the office', nullable: true })
  notes!: string | null;

  @ApiProperty({ example: 'Second installment', nullable: true })
  comments!: string | null;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  dateCreated!: string;
}

export class DashboardReceiptsResponseDto {
  @ApiProperty({ type: [DashboardReceiptDto] })
  items!: DashboardReceiptDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class DashboardPaymentDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  nb!: number;

  @ApiProperty({ example: 5 })
  accountId!: number;

  @ApiProperty({ example: '200001' })
  accountCode!: string;

  @ApiProperty({ example: 'Office supplies' })
  accountName!: string;

  @ApiProperty({ example: '150.00' })
  amount!: string;

  @ApiProperty({ example: '1000.00' })
  total!: string;

  @ApiProperty({ type: [DashboardReceiptAllocationDto] })
  allocations!: DashboardReceiptAllocationDto[];

  @ApiProperty({ type: () => DashboardReceiptCurrencyDto, nullable: true })
  currency!: DashboardReceiptCurrencyDto | null;

  @ApiProperty({ example: 1, nullable: true })
  currencyId!: number | null;

  @ApiProperty({ example: '1', nullable: true })
  currencyRate!: string | null;

  @ApiProperty({ example: 'Office supplies', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'Paid in cash', nullable: true })
  notes!: string | null;

  @ApiProperty({ example: 'Approved by principal', nullable: true })
  comments!: string | null;

  @ApiProperty({ example: '2026-09-26T10:00:00.000Z' })
  dateCreated!: string;
}

export class DashboardPaymentsResponseDto {
  @ApiProperty({ type: [DashboardPaymentDto] })
  items!: DashboardPaymentDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class DashboardInvoiceDetailBody {
  @ApiProperty({
    example: 3,
    description: 'Item owned by the authenticated school',
  })
  @Type(() => Number)
  @IsInt()
  itemId!: number;

  @ApiProperty({
    example: 100,
    description:
      'Invoice-specific unit price snapshot. Defaults to the package price, then the item base price.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitPrice?: number;

  @ApiProperty({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ example: 'Registration fee' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string;

  @ApiPropertyOptional({
    example: 450,
    description:
      'Optional registration this line belongs to. Must belong to the invoiced parent and school.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  forRegistrationId?: number;
}

export class CreateDashboardInvoiceDto extends DashboardAccountingDocumentBody {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  parentId!: number;

  @ApiProperty({
    example: '41',
    description:
      'Explicit structural code for group-hierarchy levels (e.g. 50, 500). Must start with the parent code and have exactly the required length (1->2->3->4->8 digits). Omit to let the backend allocate the next valid code. Ignored for PERSON leaves under 4111, which are always allocated by the backend.',
  })
  @Type(() => Number)
  @IsInt()
  currencyId!: number;

  @ApiProperty({
    type: [DashboardInvoiceDetailBody],
    description:
      'One or more invoice lines. Backend posts one parent debit for the total and one SALES credit for the total.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DashboardInvoiceDetailBody)
  details!: DashboardInvoiceDetailBody[];
}

export class DashboardInvoiceDetailDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 3 })
  itemId!: number;

  @ApiProperty({ example: 'Registration Fee' })
  itemName!: string;

  @ApiProperty({ example: '100.00' })
  unitPrice!: string;

  @ApiProperty({ example: '1.000' })
  quantity!: string;

  @ApiProperty({ example: '100.00' })
  lineTotal!: string;

  @ApiProperty({ example: 'Registration fee', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 450, nullable: true })
  forRegistrationId!: number | null;

  @ApiProperty({ example: 'Ahmad — Grade 1', nullable: true })
  forRegistrationLabel!: string | null;
}

export class DashboardInvoiceDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1005 })
  nb!: number;

  @ApiProperty({ example: 7 })
  parentId!: number;

  @ApiProperty({ example: 'John Doe' })
  parentName!: string;

  @ApiProperty({ example: 12 })
  accountId!: number;

  @ApiProperty({ example: '100001' })
  accountCode!: string;

  @ApiProperty({ example: '225.00' })
  total!: string;

  @ApiProperty({ type: [DashboardInvoiceDetailDto] })
  details!: DashboardInvoiceDetailDto[];

  @ApiProperty({ type: () => DashboardReceiptCurrencyDto, nullable: true })
  currency!: DashboardReceiptCurrencyDto | null;

  @ApiProperty({ example: 1, nullable: true })
  currencyId!: number | null;

  @ApiProperty({ example: '1', nullable: true })
  currencyRate!: string | null;

  @ApiProperty({ example: 'Grade 1 registration', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '2026-09-29T10:00:00.000Z' })
  dateCreated!: string;
}

export class DashboardInvoicesResponseDto {
  @ApiProperty({ type: [DashboardInvoiceDto] })
  items!: DashboardInvoiceDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class DashboardInvoicesQueryDto extends DashboardAccountingDocumentQueryDto {
  @ApiPropertyOptional({
    example: 7,
    description: 'Filter invoices billed to this parent',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;
}

export class DashboardPackagePreviewQueryDto {
  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  yearId!: number;

  @ApiPropertyOptional({
    example: 11,
    description:
      'When provided, the preview also resolves the student parent and accounting account.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  studentId?: number;
}

export class DashboardParentRegistrationsQueryDto {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  parentId!: number;
}

export class DashboardRegistrationPackagePreviewItemDto {
  @ApiProperty({ example: 3 })
  itemId!: number;

  @ApiProperty({ example: 'Registration Fee' })
  itemName!: string;

  @ApiProperty({ example: 'Services' })
  itemType!: string;

  @ApiProperty({ example: '100.00' })
  price!: string;

  @ApiProperty({ example: '100.00' })
  basePrice!: string;

  @ApiProperty({ example: true })
  mandatory!: boolean;

  @ApiProperty({ example: 1, nullable: true })
  currencyId!: number | null;

  @ApiProperty({
    type: () => DashboardReceiptCurrencyDto,
    nullable: true,
  })
  currency!: DashboardReceiptCurrencyDto | null;
}

export class DashboardRegistrationPackagePreviewParentDto {
  @ApiProperty({ example: 7 })
  parentId!: number;

  @ApiProperty({ example: 'John Doe' })
  parentName!: string;

  @ApiProperty({ example: 12, nullable: true })
  accountId!: number | null;

  @ApiProperty({ example: '100001', nullable: true })
  accountCode!: string | null;

  @ApiProperty({ example: true })
  hasAccountingAccount!: boolean;
}

export class DashboardRegistrationPackagePreviewPackageDto {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: 'Grade 1 Registration Package' })
  name!: string;

  @ApiProperty({ type: [DashboardRegistrationPackagePreviewItemDto] })
  items!: DashboardRegistrationPackagePreviewItemDto[];
}

export class DashboardRegistrationPackagePreviewDto {
  @ApiProperty({
    type: () => DashboardRegistrationPackagePreviewPackageDto,
    nullable: true,
  })
  package!: DashboardRegistrationPackagePreviewPackageDto | null;

  @ApiProperty({
    type: () => DashboardRegistrationPackagePreviewParentDto,
    nullable: true,
  })
  parent!: DashboardRegistrationPackagePreviewParentDto | null;

  @ApiProperty({ example: 'Grade 1' })
  className!: string;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;
}

export class DashboardParentRegistrationDto {
  @ApiProperty({ example: 450 })
  id!: number;

  @ApiProperty({ example: 11 })
  studentId!: number;

  @ApiProperty({ example: 'Ahmad' })
  studentName!: string;

  @ApiProperty({ example: 'Grade 1' })
  className!: string;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: 'Ahmad — Grade 1' })
  label!: string;
}

export class DashboardRegistrationWithInvoiceDto {
  @ApiProperty({ example: 450 })
  registrationId!: number;

  @ApiProperty({ type: () => DashboardInvoiceDto })
  invoice!: DashboardInvoiceDto;
}

export class DashboardRecordRowBody {
  @ApiProperty({
    example: 12,
    description: 'Same-school account of any type for manual journal entries',
  })
  @Type(() => Number)
  @IsInt()
  accountId!: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit?: number;

  @ApiPropertyOptional({ example: 'Tuition accrual' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string;
}

export class CreateDashboardRecordDto extends DashboardAccountingDocumentBody {
  @ApiProperty({
    example: 1,
    description: 'Single record currency for all journal rows.',
  })
  @Type(() => Number)
  @IsInt()
  currencyId!: number;

  @ApiProperty({
    type: [DashboardRecordRowBody],
    description:
      'Two or more journal rows. Each row carries either a debit or a credit, never both. Totals must balance exactly.',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DashboardRecordRowBody)
  rows!: DashboardRecordRowBody[];
}

export class DashboardRecordRowDto {
  @ApiProperty({ example: 12 })
  accountId!: number;

  @ApiProperty({ example: '100001' })
  accountCode!: string;

  @ApiProperty({ example: 'Maya Joseph Hassan' })
  accountName!: string;

  @ApiProperty({ example: '500.00' })
  debit!: string;

  @ApiProperty({ example: '0.00' })
  credit!: string;

  @ApiProperty({ example: 'Tuition accrual', nullable: true })
  description!: string | null;
}

export class DashboardRecordDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  nb!: number;

  @ApiProperty({ example: '1800.00' })
  totalDebit!: string;

  @ApiProperty({ example: '1800.00' })
  totalCredit!: string;

  @ApiProperty({ type: [DashboardRecordRowDto] })
  rows!: DashboardRecordRowDto[];

  @ApiProperty({ type: () => DashboardReceiptCurrencyDto, nullable: true })
  currency!: DashboardReceiptCurrencyDto | null;

  @ApiProperty({ example: 1, nullable: true })
  currencyId!: number | null;

  @ApiProperty({ example: '1', nullable: true })
  currencyRate!: string | null;

  @ApiProperty({ example: 'Year-end accrual', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 'Audited', nullable: true })
  notes!: string | null;

  @ApiProperty({ example: 'Board approved', nullable: true })
  comments!: string | null;

  @ApiProperty({ example: '2026-09-30T10:00:00.000Z' })
  dateCreated!: string;
}

export class DashboardRecordsResponseDto {
  @ApiProperty({ type: [DashboardRecordDto] })
  items!: DashboardRecordDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 5 })
  totalPages!: number;
}

export class DashboardStatementQueryDto {
  @ApiPropertyOptional({
    example: 12,
    description: 'Supplied by the route; an explicit query value is ignored.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  accountId?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 'Invoice' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  documentType?: string;

  @ApiPropertyOptional({ example: 'tuition' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class DashboardStatementRowDto {
  @ApiProperty({ example: '2026-09-28T10:00:00.000Z' })
  date!: string;

  @ApiProperty({ example: 'Invoice' })
  documentType!: string;

  @ApiProperty({ example: 1005 })
  documentNb!: number | null;

  @ApiProperty({ example: 900, nullable: true })
  documentId!: number | null;

  @ApiProperty({ example: 'invoices', nullable: true })
  documentKind!: string | null;

  @ApiProperty({ example: 'Registration Invoice', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '150.00' })
  debit!: string;

  @ApiProperty({ example: '0.00' })
  credit!: string;

  @ApiProperty({ example: '-150.00' })
  balance!: string;

  @ApiProperty({ example: 'USD' })
  currencyShortCode!: string;

  @ApiProperty({ example: '$' })
  currencySymbol!: string;
}

export class DashboardStatementCurrencySummaryDto {
  @ApiProperty({ example: 1 })
  currencyId!: number;

  @ApiProperty({ example: 'USD' })
  shortCode!: string;

  @ApiProperty({ example: '$' })
  symbol!: string;

  @ApiProperty({ example: 'Opening balance', nullable: true })
  openingBalance!: string;

  @ApiProperty({ example: '1500.00' })
  totalDebit!: string;

  @ApiProperty({ example: '1000.00' })
  totalCredit!: string;

  @ApiProperty({ example: '-500.00' })
  closingBalance!: string;
}

export class DashboardStatementDto {
  @ApiProperty({ example: 12 })
  accountId!: number;

  @ApiProperty({ example: '100001' })
  accountCode!: string;

  @ApiProperty({ example: 'Maya Joseph Hassan' })
  accountName!: string;

  @ApiProperty({ example: 'PERSON' })
  accountType!: string;

  @ApiProperty({ type: [DashboardStatementCurrencySummaryDto] })
  summaries!: DashboardStatementCurrencySummaryDto[];

  @ApiProperty({ type: [DashboardStatementRowDto] })
  rows!: DashboardStatementRowDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;

  @ApiProperty({ example: 4 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class DashboardRegistrationInvoiceItemBody {
  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  itemId!: number;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Optional price override. Defaults to the package price, then the item base price.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitPrice?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  quantity?: number;

  @ApiPropertyOptional({ example: 'School uniform pants - size 10' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string;
}

export class CreateDashboardRegistrationInvoiceDto extends DashboardAccountingDocumentBody {
  @ApiProperty({ example: 11 })
  @Type(() => Number)
  @IsInt()
  studentId!: number;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt()
  classId!: number;

  @ApiProperty({ example: 9 })
  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currencyId?: number;

  @ApiProperty({
    type: [DashboardRegistrationInvoiceItemBody],
    description:
      'Package items to invoice. Every generated detail links to the new registration.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => DashboardRegistrationInvoiceItemBody)
  items!: DashboardRegistrationInvoiceItemBody[];
}

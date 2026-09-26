import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
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
    enum: ['PERSON', 'CASH', 'SALES', 'PURCHASES'],
  })
  type!: string;
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
}

class DashboardAccountingDocumentBody {
  @ApiProperty({ example: 123.45 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  currencyId?: number;

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

export class CreateDashboardReceiptDto extends DashboardAccountingDocumentBody {
  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  parentId!: number;
}

export class CreateDashboardPaymentDto extends DashboardAccountingDocumentBody {
  @ApiProperty({
    example: 5,
    description: 'Destination accounting account owned by the school',
  })
  @Type(() => Number)
  @IsInt()
  accountId!: number;
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

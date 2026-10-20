import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateDashboardInstallmentDto {
  @ApiProperty() @IsInt() @IsPositive() accountId!: number;
  @ApiProperty() @IsNumber() @Min(0.01) amount!: number;
  @ApiProperty() @IsInt() @IsPositive() yearId!: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsDateString() date?: string;
}
export class UpdateDashboardInstallmentDto extends CreateDashboardInstallmentDto {}
export class CreateDashboardInstallmentBatchDto {
  @ApiProperty({ type: [CreateDashboardInstallmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDashboardInstallmentDto)
  rows!: CreateDashboardInstallmentDto[];
}
export class DashboardInstallmentsQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() accountId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() yearId?: number;
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') paid?: boolean;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}
export class LinkDashboardInstallmentReceiptDto { @ApiProperty() @IsInt() @IsPositive() receiptId!: number; }

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  ArrayUnique,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class DashboardConfigQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class DashboardItemsQueryDto extends DashboardConfigQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemTypeId?: number;
}

export class SaveDashboardItemDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemTypeId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}

export class DashboardPackagesQueryDto extends DashboardConfigQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId?: number;
}

export class SaveDashboardPackageDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId!: number;
}

export class SaveDashboardPackageItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsBoolean()
  mandatory!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  currencyId!: number;
}

export class AssignDashboardPackageClassesDto {
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  classIds!: number[];
}

export class SaveCompleteDashboardPackageDto extends SaveDashboardPackageDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveDashboardPackageItemDto)
  items!: SaveDashboardPackageItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  classIds!: number[];
}

export class DashboardPackageClassesQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  yearId!: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaveDashboardGradeFormExpressionItemDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceGradeTypeId!: number;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percentage!: number;
}

export class SaveDashboardGradeFormExpressionsDto {
  @ApiProperty({ type: [SaveDashboardGradeFormExpressionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveDashboardGradeFormExpressionItemDto)
  items!: SaveDashboardGradeFormExpressionItemDto[];
}

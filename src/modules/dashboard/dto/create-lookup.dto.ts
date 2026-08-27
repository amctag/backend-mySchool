import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateNamedLookupDto {
  @ApiProperty({ example: 'Lebanese' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class CreateRegionDto extends CreateNamedLookupDto {
  @ApiProperty({
    example: 1,
    description: 'Governorate table id',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  governorateId!: number;
}


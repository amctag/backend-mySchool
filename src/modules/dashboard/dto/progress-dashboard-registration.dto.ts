import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  Min,
} from 'class-validator';
import { DashboardRegistrationItemDto } from './dashboard-registrations-response.dto';

export class ProgressDashboardRegistrationDto {
  @ApiProperty({
    enum: ['up', 'down', 'stay'],
    example: 'up',
    description:
      'up = next classLevel, down = previous classLevel, stay = same class for the next school year',
  })
  @IsIn(['up', 'down', 'stay'])
  action!: 'up' | 'down' | 'stay';
}

export class BulkProgressDashboardRegistrationDto {
  @ApiProperty({
    enum: ['up', 'down', 'stay'],
    example: 'up',
  })
  @IsIn(['up', 'down', 'stay'])
  action!: 'up' | 'down' | 'stay';

  @ApiProperty({
    type: [Number],
    example: [1, 2, 3],
    description: 'Registration ids to progress in one request',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  registrationIds!: number[];
}

export class BulkProgressRegistrationResultDto {
  @ApiProperty({ example: 12 })
  registrationId!: number;

  @ApiProperty({ example: 'Mira Maya Hassan' })
  studentName!: string;

  @ApiProperty({ example: true })
  ok!: boolean;

  @ApiProperty({
    example: '2027-2028 · Grade 4 · Level 4 · A',
    required: false,
  })
  message!: string;

  @ApiProperty({ type: DashboardRegistrationItemDto, required: false })
  created?: DashboardRegistrationItemDto;
}

export class BulkProgressRegistrationsResponseDto {
  @ApiProperty({ type: [BulkProgressRegistrationResultDto] })
  items!: BulkProgressRegistrationResultDto[];

  @ApiProperty({ example: 3 })
  successCount!: number;

  @ApiProperty({ example: 1 })
  failCount!: number;
}

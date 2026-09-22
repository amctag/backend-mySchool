import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

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

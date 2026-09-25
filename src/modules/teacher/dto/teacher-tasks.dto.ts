import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeacherTaskItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Submit midterm grades' })
  title!: string;

  @ApiProperty({ example: 'Please enter all midterm grades before Friday.' })
  description!: string;

  @ApiProperty({ example: '2026-09-22T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: false })
  isCompleted!: boolean;

  @ApiPropertyOptional({
    example: '2026-09-22T15:00:00.000Z',
    nullable: true,
  })
  completedAt!: string | null;
}

export class TeacherTasksResponseDto {
  @ApiProperty({ type: [TeacherTaskItemDto] })
  tasks!: TeacherTaskItemDto[];
}

import { ApiProperty } from '@nestjs/swagger';

export class ParentActivityItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Sports Day' })
  title!: string;

  @ApiProperty({ example: 'Annual sports day for all students.' })
  content!: string;

  @ApiProperty({ example: '2026-03-15' })
  date!: string;

  @ApiProperty({ example: 'https://cdn.example.com/activities/sports-day.jpg' })
  image!: string;

  @ApiProperty({ example: '2025-2026', nullable: true })
  yearTitle!: string | null;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;
}

export class ParentActivitiesResponseDto {
  @ApiProperty({ type: [ParentActivityItemDto] })
  activities!: ParentActivityItemDto[];
}

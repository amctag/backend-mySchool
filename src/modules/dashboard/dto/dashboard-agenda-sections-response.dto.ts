import { ApiProperty } from '@nestjs/swagger';

export class DashboardAgendaSectionRowDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  agendaId!: number;

  @ApiProperty({ example: 'Complete exercises 1–10 on page 42.' })
  agendaDescription!: string;

  @ApiProperty({ example: '2026-09-04' })
  agendaDate!: string;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;
}

export class DashboardAgendaSectionsResponseDto {
  @ApiProperty({ type: [DashboardAgendaSectionRowDto] })
  items!: DashboardAgendaSectionRowDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

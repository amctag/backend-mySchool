import { ApiProperty } from '@nestjs/swagger';

export class DashboardAgendaSectionItemDto {
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

export class DashboardAgendaItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Fractions practice' })
  title!: string;

  @ApiProperty({ example: 'Complete exercises 1–10 on page 42.' })
  description!: string;

  @ApiProperty({ example: '2026-09-04' })
  agendaDate!: string;

  @ApiProperty({ example: '09:00' })
  time!: string;

  @ApiProperty({ example: 1 })
  courseId!: number;

  @ApiProperty({ example: 'Mathematics' })
  courseTitle!: string;

  @ApiProperty({ example: 'https://cdn.example.com/agendas/hw.jpg' })
  imageLink!: string;

  @ApiProperty({ example: 'https://cdn.example.com/agendas/hw.pdf' })
  fileLink!: string;

  @ApiProperty({ example: '2026-09-01T08:00:00.000Z' })
  publishedDate!: string;

  @ApiProperty({ example: 1 })
  status!: number;

  @ApiProperty({ type: [DashboardAgendaSectionItemDto] })
  sections!: DashboardAgendaSectionItemDto[];

  @ApiProperty({ example: 'Grade 4/A' })
  sectionsLabel!: string;
}

export class DashboardAgendasResponseDto {
  @ApiProperty({ type: [DashboardAgendaItemDto] })
  items!: DashboardAgendaItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

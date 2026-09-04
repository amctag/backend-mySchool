import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardAttendanceListItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: '2026-09-04' })
  date!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 2' })
  className!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ example: true })
  status!: boolean;

  @ApiProperty({ example: 28 })
  studentCount!: number;

  @ApiProperty({ example: 2 })
  absentCount!: number;
}

export class DashboardAttendancesResponseDto {
  @ApiProperty({ type: [DashboardAttendanceListItemDto] })
  items!: DashboardAttendanceListItemDto[];

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class DashboardAttendanceStudentRowDto {
  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 1 })
  registrationId!: number;

  @ApiProperty({ example: 'Adam Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({
    enum: ['present', 'absent', 'late', 'excused'],
    example: 'present',
  })
  status!: 'present' | 'absent' | 'late' | 'excused';

  @ApiPropertyOptional({ nullable: true, example: 'Fever' })
  description!: string | null;
}

export class DashboardAttendanceSheetDto {
  @ApiPropertyOptional({ nullable: true, example: 1 })
  attendanceId!: number | null;

  @ApiProperty({ example: '2026-09-04' })
  date!: string;

  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 'A' })
  sectionTitle!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 2' })
  className!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2026-2027' })
  yearTitle!: string;

  @ApiProperty({ type: [DashboardAttendanceStudentRowDto] })
  students!: DashboardAttendanceStudentRowDto[];
}

export class DashboardAttendanceDetailResponseDto extends DashboardAttendanceSheetDto {
  @ApiProperty({ example: true })
  status!: boolean;
}

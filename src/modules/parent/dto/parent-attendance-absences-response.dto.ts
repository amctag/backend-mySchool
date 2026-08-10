import { ApiProperty } from '@nestjs/swagger';

export class ParentAttendanceAbsenceItemDto {
  @ApiProperty({ example: 1 })
  studentId!: number;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  studentName!: string;

  @ApiProperty({ example: '2026-08-05' })
  date!: string;

  @ApiProperty({ example: 'absent' })
  status!: string;

  @ApiProperty({ example: 'Fever', nullable: true })
  reason!: string | null;

  @ApiProperty({ example: 'Stayed home due to fever', nullable: true })
  description!: string | null;
}

export class ParentAttendanceAbsencesResponseDto {
  @ApiProperty({ example: '2026-08' })
  month!: string;

  @ApiProperty({ type: [ParentAttendanceAbsenceItemDto] })
  absences!: ParentAttendanceAbsenceItemDto[];
}

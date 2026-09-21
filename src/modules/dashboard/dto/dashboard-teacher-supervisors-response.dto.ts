import { ApiProperty } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.dto';

export class DashboardTeacherSupervisorItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 1 })
  teacherId!: number;

  @ApiProperty({ example: 'Sara Nabil Haddad' })
  teacherName!: string;

  @ApiProperty({ example: 1 })
  classId!: number;

  @ApiProperty({ example: 'Grade 4' })
  className!: string;

  @ApiProperty({ example: 1 })
  yearId!: number;

  @ApiProperty({ example: '2025-2026' })
  yearTitle!: string;

  @ApiProperty({ example: true })
  isCurrentYear!: boolean;
}

export class DashboardTeacherSupervisorsResponseDto {
  @ApiProperty({ type: [DashboardTeacherSupervisorItemDto] })
  items!: DashboardTeacherSupervisorItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class DashboardTeacherSupervisorCreateResponseDto {
  @ApiProperty({ type: [DashboardTeacherSupervisorItemDto] })
  items!: DashboardTeacherSupervisorItemDto[];
}

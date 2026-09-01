import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DashboardGradeFormDetailRowDto } from './dashboard-grade-form-details-response.dto';
import { DashboardGradeFormDetailDto } from './dashboard-grade-forms-response.dto';

export class DashboardGradeFormByClassResponseDto {
  @ApiPropertyOptional({ type: DashboardGradeFormDetailDto, nullable: true })
  gradeForm!: DashboardGradeFormDetailDto | null;

  @ApiProperty({ type: [DashboardGradeFormDetailRowDto] })
  details!: DashboardGradeFormDetailRowDto[];
}

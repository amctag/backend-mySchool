import { ApiProperty } from '@nestjs/swagger';
import { DashboardTeacherDetailDto } from './dashboard-teacher-detail.dto';

/**
 * A director detail record is the linked person profile (same fields as a
 * teacher) plus the director identity, the tenant school link, and the linked
 * `persons.id` used by the Director Flutter app to sign in.
 */
export class DashboardDirectorDetailDto extends DashboardTeacherDetailDto {
  @ApiProperty({
    example: 669,
    description: 'Linked persons.id. The Director app signs in with this id.',
  })
  personId!: number;

  @ApiProperty({ example: 12 })
  directorId!: number;

  @ApiProperty({ example: 1 })
  schoolId!: number;

  @ApiProperty({ example: 'Green Valley School' })
  schoolName!: string;

  @ApiProperty({ example: true })
  isActiveInSchool!: boolean;
}

import { ApiProperty } from '@nestjs/swagger';

export class ParentChildSummaryDto {
  @ApiProperty({ example: 1 })
  studentId: number;

  @ApiProperty({ example: 12, nullable: true })
  registrationId: number | null;

  @ApiProperty({ example: 'Layla Ahmad Khalil' })
  name: string;

  @ApiProperty({ example: '2025-2026', nullable: true })
  yearTitle: string | null;
}

export class ParentMeChildrenSummaryResponseDto {
  @ApiProperty({ type: [ParentChildSummaryDto] })
  children: ParentChildSummaryDto[];
}

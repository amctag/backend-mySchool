import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeacherNotificationItemDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'New announcement' })
  title!: string;

  @ApiProperty({ example: 'School will be closed on Friday.' })
  body!: string;

  @ApiPropertyOptional({ example: 'announcement', nullable: true })
  type!: string | null;

  @ApiPropertyOptional({ example: 'announcements', nullable: true })
  route!: string | null;

  @ApiProperty({
    example: {
      type: 'announcement',
      announcementId: '12',
      route: 'announcements',
    },
    type: 'object',
    additionalProperties: true,
  })
  data!: Record<string, string>;

  @ApiProperty({ example: '2026-09-15T11:00:00.000Z' })
  createdAt!: string;
}

export class TeacherNotificationsResponseDto {
  @ApiProperty({ type: [TeacherNotificationItemDto] })
  notifications!: TeacherNotificationItemDto[];
}

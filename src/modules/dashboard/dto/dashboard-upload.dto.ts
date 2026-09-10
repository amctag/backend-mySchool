import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class DashboardUploadQueryDto {
  @ApiProperty({
    example: 'image',
    enum: ['image', 'file'],
    required: false,
    description: 'image = jpeg/png/webp/gif. file = pdf.',
  })
  @IsOptional()
  @IsString()
  @IsIn(['image', 'file'])
  kind?: 'image' | 'file';
}

export class DashboardUploadResponseDto {
  @ApiProperty({
    example: 'https://st79068.ispot.cc/myschool/images/uuid.jpg',
  })
  url!: string;

  @ApiProperty({ example: 'image/uuid.jpg' })
  path!: string;

  @ApiProperty({ example: 'image' })
  category!: string;
}

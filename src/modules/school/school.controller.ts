import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SchoolDetailsQueryDto } from './dto/school-details-query.dto';
import { SchoolDetailsResponseDto } from './dto/school-details-response.dto';
import { SchoolService } from './school.service';

@ApiTags('School v1')
@Controller({ path: 'school', version: '1' })
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Public()
  @Get('details')
  @ApiOperation({ summary: 'Get contact and about information for a school' })
  @ApiOkResponse({ type: SchoolDetailsResponseDto })
  @ApiNotFoundResponse({ description: 'School details not found' })
  getSchoolDetails(
    @Query() query: SchoolDetailsQueryDto,
  ): Promise<SchoolDetailsResponseDto> {
    return this.schoolService.getSchoolDetails(query.schoolId);
  }
}

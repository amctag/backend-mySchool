import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { TeacherSchoolDetailsResponseDto } from './dto/teacher-school-details-response.dto';
import { TeacherSupportSchoolsDto } from './dto/teacher-support-schools.dto';
import { TeacherAuthService } from './teacher-auth.service';

@ApiTags('Teacher Auth v1')
@Controller({ path: 'teacher', version: '1' })
export class TeacherSupportController {
  constructor(private readonly teacherAuthService: TeacherAuthService) {}

  @Public()
  @Post('support/schools')
  @ApiOperation({
    summary: 'Look up school contact details for teacher support',
    description:
      'Resolves a person ID or teacher ID to their school contact details without requiring a password.',
  })
  @ApiOkResponse({ type: TeacherSchoolDetailsResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Could not find support information' })
  getSupportSchools(
    @Body() dto: TeacherSupportSchoolsDto,
  ): Promise<TeacherSchoolDetailsResponseDto> {
    return this.teacherAuthService.getSupportSchools(dto);
  }
}

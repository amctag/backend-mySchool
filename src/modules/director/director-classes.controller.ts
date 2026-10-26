import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorClassesQueryDto,
  DirectorClassesResponseDto,
  DirectorClassStudentsResponseDto,
  DirectorClassDetailsResponseDto,
} from './dto/director-classes.dto';
import { DirectorClassesService } from './director-classes.service';

@ApiTags('Director Classes v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorClassesController {
  constructor(private readonly directorClassesService: DirectorClassesService) {}

  @Get('me/classes')
  @ApiOperation({
    summary: 'List all classes in the director\'s school',
    description:
      'Returns all sections/sections in the director\'s assigned school. Optional year filter.',
  })
  @ApiOkResponse({ type: DirectorClassesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listMyClasses(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorClassesQueryDto,
  ): Promise<DirectorClassesResponseDto> {
    return this.directorClassesService.listMyClasses(request.user, query);
  }

  @Get('me/class-schedules')
  @ApiOperation({
    summary: 'List all class schedules in the director\'s school',
    description:
      'Returns all sections in the director\'s assigned school. Assigned classes are flagged.',
  })
  @ApiOkResponse({ type: DirectorClassesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listClassSchedules(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorClassesQueryDto,
  ): Promise<DirectorClassesResponseDto> {
    return this.directorClassesService.listClassSchedules(request.user, query);
  }

  @Get('me/classes/:classId/students')
  @ApiOperation({
    summary: 'List students in one of the director\'s classes',
    description:
      'Active registrations for a section in the director\'s school. Returns 403 if the class is not in the director\'s school.',
  })
  @ApiOkResponse({ type: DirectorClassStudentsResponseDto })
  @ApiForbiddenResponse({ description: 'Class not found in director\'s school' })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  listClassStudents(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('classId', ParseIntPipe) classId: number,
  ): Promise<DirectorClassStudentsResponseDto> {
    return this.directorClassesService.listClassStudents(request.user, classId);
  }

  @Get('me/classes/:classId')
  @ApiOperation({
    summary: 'Get class details',
    description:
      'Class summary, student roster, weekly schedule, and all teachers for a section in the director\'s school.',
  })
  @ApiOkResponse({ type: DirectorClassDetailsResponseDto })
  @ApiNotFoundResponse({ description: 'Class not found' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired token' })
  getClassDetails(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('classId', ParseIntPipe) classId: number,
  ): Promise<DirectorClassDetailsResponseDto> {
    return this.directorClassesService.getClassDetails(request.user, classId);
  }
}
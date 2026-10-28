import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedDirector } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  DirectorGradeEntryQueryDto,
  DirectorGradesQueryDto,
  SaveDirectorGradeSheetDto,
} from './dto/director-grades.dto';
import { DirectorGradesService } from './director-grades.service';

@ApiTags('Director Grades v1')
@ApiBearerAuth()
@Roles('director')
@Controller({ path: 'director', version: '1' })
export class DirectorGradesController {
  constructor(private readonly directorGradesService: DirectorGradesService) {}

  @Get('me/grades/options')
  @ApiOperation({
    summary: 'List director grade entry options',
    description:
      "Returns school grade types, coefficients and configuration for the director's school.",
  })
  @ApiOkResponse({ type: Object })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  listOptions(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorGradesQueryDto,
  ): Promise<Object> {
    return this.directorGradesService.listOptions(request.user);
  }

  @Post('me/grades')
  save(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Body() body: SaveDirectorGradeSheetDto,
  ) {
    return this.directorGradesService.save(request.user, body);
  }

  @Patch('me/grades/:id/publication')
  setPublication(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('id', ParseIntPipe) id: number,
    @Body('published') published: boolean,
  ) {
    return this.directorGradesService.setPublication(
      request.user,
      id,
      published === true,
    );
  }

  @Delete('me/grades/:id')
  remove(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.directorGradesService.delete(request.user, id);
  }

  @Get('me/grades')
  @ApiOperation({
    summary: "List all grade sheets in the director's school",
    description:
      "Returns all grade entries for the director's school. Filterable by class, course, and grade type.",
  })
  @ApiOkResponse({ type: Object })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  listSheets(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorGradesQueryDto,
  ): Promise<Object> {
    return this.directorGradesService.listSheets(request.user, query);
  }

  @Get('me/grades/entry')
  @ApiOperation({
    summary: 'Load students for grade entry',
    description:
      "Returns roster for grade entry in a section, course, and grade type for the director's school.",
  })
  @ApiOkResponse({ type: Object })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid, or expired token',
  })
  getEntry(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Query() query: DirectorGradeEntryQueryDto,
  ): Promise<Object> {
    return this.directorGradesService.getEntry(request.user, query);
  }

  @Get('me/grades/:id')
  getOne(
    @Req() request: Request & { user: AuthenticatedDirector },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.directorGradesService.getEntry(request.user, { gradeId: id });
  }
}

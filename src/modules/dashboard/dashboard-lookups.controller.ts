import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateNamedLookupDto,
  CreateRegionDto,
} from './dto/create-lookup.dto';
import { LookupItemDto, RegionItemDto } from './dto/lookup-item.dto';
import { DashboardLookupsService } from './dashboard-lookups.service';

class RegionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  governorateId?: number;
}

@ApiTags('Dashboard Lookups v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/lookups', version: '1' })
export class DashboardLookupsController {
  constructor(
    private readonly dashboardLookupsService: DashboardLookupsService,
  ) {}

  @Get('nationalities')
  @ApiOperation({ summary: 'List nationalities' })
  @ApiOkResponse({ type: [LookupItemDto] })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  listNationalities(): Promise<LookupItemDto[]> {
    return this.dashboardLookupsService.listNationalities();
  }

  @Post('nationalities')
  @ApiOperation({ summary: 'Add a nationality' })
  @ApiCreatedResponse({ type: LookupItemDto })
  createNationality(
    @Body() dto: CreateNamedLookupDto,
  ): Promise<LookupItemDto> {
    return this.dashboardLookupsService.createNationality(dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List parent jobs' })
  @ApiOkResponse({ type: [LookupItemDto] })
  listJobs(): Promise<LookupItemDto[]> {
    return this.dashboardLookupsService.listJobs();
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Add a parent job' })
  @ApiCreatedResponse({ type: LookupItemDto })
  createJob(@Body() dto: CreateNamedLookupDto): Promise<LookupItemDto> {
    return this.dashboardLookupsService.createJob(dto);
  }

  @Get('governorates')
  @ApiOperation({ summary: 'List governorates by name' })
  @ApiOkResponse({ type: [LookupItemDto] })
  listGovernorates(): Promise<LookupItemDto[]> {
    return this.dashboardLookupsService.listGovernorates();
  }

  @Post('governorates')
  @ApiOperation({ summary: 'Add a governorate name' })
  @ApiCreatedResponse({ type: LookupItemDto })
  createGovernorate(
    @Body() dto: CreateNamedLookupDto,
  ): Promise<LookupItemDto> {
    return this.dashboardLookupsService.createGovernorate(dto);
  }

  @Get('regions')
  @ApiOperation({ summary: 'List regions, optionally by governorate' })
  @ApiOkResponse({ type: [RegionItemDto] })
  listRegions(@Query() query: RegionsQueryDto): Promise<RegionItemDto[]> {
    return this.dashboardLookupsService.listRegions(query.governorateId);
  }

  @Post('regions')
  @ApiOperation({ summary: 'Add a region under a governorate' })
  @ApiCreatedResponse({ type: RegionItemDto })
  createRegion(@Body() dto: CreateRegionDto): Promise<RegionItemDto> {
    return this.dashboardLookupsService.createRegion(dto);
  }
}

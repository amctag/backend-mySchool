import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthenticatedSchool } from '../../auth/interfaces/jwt-payload.interface';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardAccountingService } from './dashboard-accounting.service';
import { DashboardAccountingConfigService } from './dashboard-accounting-config.service';
import {
  AssignDashboardPackageClassesDto,
  DashboardItemsQueryDto,
  DashboardPackagesQueryDto,
  SaveDashboardItemDto,
  SaveDashboardPackageDto,
  SaveDashboardPackageItemDto,
} from './dto/dashboard-accounting-config.dto';
import {
  CreateDashboardAccountDto,
  CreateDashboardPaymentDto,
  CreateDashboardReceiptDto,
  DashboardAccountDto,
  DashboardAccountingDocumentQueryDto,
  DashboardAccountsQueryDto,
  DashboardAccountsResponseDto,
  DashboardCurrencyDto,
  DashboardPaymentDto,
  DashboardPaymentsResponseDto,
  DashboardReceiptDto,
  DashboardReceiptsResponseDto,
  UpdateDashboardAccountDto,
} from './dto/dashboard-accounting.dto';

@ApiTags('Dashboard Accounting v1')
@ApiBearerAuth()
@Roles('school')
@Controller({ path: 'dashboard/accounting', version: '1' })
export class DashboardAccountingController {
  constructor(
    private readonly dashboardAccountingService: DashboardAccountingService,
    private readonly accountingConfigService: DashboardAccountingConfigService,
  ) {}

  @Get('currencies')
  @ApiOperation({ summary: 'List database-backed accounting currencies' })
  @ApiOkResponse({ type: [DashboardCurrencyDto] })
  listCurrencies(): Promise<DashboardCurrencyDto[]> {
    return this.dashboardAccountingService.listCurrencies();
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List accounting accounts owned by this school' })
  @ApiOkResponse({ type: DashboardAccountsResponseDto })
  listAccounts(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAccountsQueryDto,
  ): Promise<DashboardAccountsResponseDto> {
    return this.dashboardAccountingService.listAccounts(request.user, query);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get an accounting account owned by this school' })
  @ApiOkResponse({ type: DashboardAccountDto })
  getAccount(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAccountDto> {
    return this.dashboardAccountingService.getAccount(request.user, id);
  }

  @Post('accounts')
  @ApiOperation({
    summary: 'Create a GENERAL accounting account for this school',
  })
  @ApiCreatedResponse({ type: DashboardAccountDto })
  createAccount(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardAccountDto,
  ): Promise<DashboardAccountDto> {
    return this.dashboardAccountingService.createAccount(request.user, dto);
  }

  @Patch('accounts/:id')
  @ApiOperation({
    summary: 'Rename a GENERAL accounting account of this school',
  })
  @ApiOkResponse({ type: DashboardAccountDto })
  updateAccount(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDashboardAccountDto,
  ): Promise<DashboardAccountDto> {
    return this.dashboardAccountingService.updateAccount(request.user, id, dto);
  }

  @Post('system-accounts/setup')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Ensure Cash, Sales and Purchases system accounts exist for this school (idempotent)',
  })
  @ApiOkResponse({ type: [DashboardAccountDto] })
  setupSystemAccounts(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardAccountDto[]> {
    return this.dashboardAccountingService.ensureSystemAccounts(request.user);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'List Receipt documents for this school' })
  @ApiOkResponse({ type: DashboardReceiptsResponseDto })
  listReceipts(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAccountingDocumentQueryDto,
  ): Promise<DashboardReceiptsResponseDto> {
    return this.dashboardAccountingService.listReceipts(request.user, query);
  }

  @Post('receipts')
  @ApiOperation({ summary: 'Post a Receipt: receive money from a parent' })
  @ApiCreatedResponse({ type: DashboardReceiptDto })
  createReceipt(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardReceiptDto,
  ): Promise<DashboardReceiptDto> {
    return this.dashboardAccountingService.createReceipt(request.user, dto);
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Get a Receipt document for this school' })
  @ApiOkResponse({ type: DashboardReceiptDto })
  getReceipt(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardReceiptDto> {
    return this.dashboardAccountingService.getReceipt(request.user, id);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List Payment documents for this school' })
  @ApiOkResponse({ type: DashboardPaymentsResponseDto })
  listPayments(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAccountingDocumentQueryDto,
  ): Promise<DashboardPaymentsResponseDto> {
    return this.dashboardAccountingService.listPayments(request.user, query);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Post a Payment against a school account' })
  @ApiCreatedResponse({ type: DashboardPaymentDto })
  createPayment(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardPaymentDto,
  ): Promise<DashboardPaymentDto> {
    return this.dashboardAccountingService.createPayment(request.user, dto);
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get a Payment document for this school' })
  @ApiOkResponse({ type: DashboardPaymentDto })
  getPayment(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardPaymentDto> {
    return this.dashboardAccountingService.getPayment(request.user, id);
  }

  @Get('item-types')
  listItemTypes() {
    return this.accountingConfigService.listItemTypes();
  }

  @Get('items')
  listItems(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardItemsQueryDto,
  ) {
    return this.accountingConfigService.listItems(request.user, query);
  }

  @Get('items/:id')
  getItem(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.accountingConfigService.getItem(request.user, id);
  }

  @Post('items')
  createItem(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: SaveDashboardItemDto,
  ) {
    return this.accountingConfigService.createItem(request.user, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveDashboardItemDto,
  ) {
    return this.accountingConfigService.updateItem(request.user, id, dto);
  }

  @Delete('items/:id')
  deleteItem(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.accountingConfigService.deleteItem(request.user, id);
  }

  @Get('registration-packages')
  listPackages(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardPackagesQueryDto,
  ) {
    return this.accountingConfigService.listPackages(request.user, query);
  }

  @Get('registration-packages/:id')
  getPackage(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.accountingConfigService.getPackage(request.user, id);
  }

  @Post('registration-packages')
  createPackage(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: SaveDashboardPackageDto,
  ) {
    return this.accountingConfigService.createPackage(request.user, dto);
  }

  @Patch('registration-packages/:id')
  updatePackage(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveDashboardPackageDto,
  ) {
    return this.accountingConfigService.updatePackage(request.user, id, dto);
  }

  @Delete('registration-packages/:id')
  deletePackage(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.accountingConfigService.deletePackage(request.user, id);
  }

  @Post('registration-packages/:id/items')
  addPackageItem(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveDashboardPackageItemDto,
  ) {
    return this.accountingConfigService.addPackageItem(request.user, id, dto);
  }

  @Delete('registration-packages/:id/items/:relationId')
  removePackageItem(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Param('relationId', ParseIntPipe) relationId: number,
  ) {
    return this.accountingConfigService.removePackageItem(
      request.user,
      id,
      relationId,
    );
  }

  @Post('registration-packages/:id/classes')
  assignPackageClasses(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDashboardPackageClassesDto,
  ) {
    return this.accountingConfigService.assignPackageClasses(
      request.user,
      id,
      dto,
    );
  }

  @Delete('registration-packages/:id/classes/:relationId')
  removePackageClass(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Param('relationId', ParseIntPipe) relationId: number,
  ) {
    return this.accountingConfigService.removePackageClass(
      request.user,
      id,
      relationId,
    );
  }
}

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
  DashboardPackageClassesQueryDto,
  DashboardPackagesQueryDto,
  SaveDashboardItemDto,
  SaveDashboardPackageItemDto,
  SaveCompleteDashboardPackageDto,
} from './dto/dashboard-accounting-config.dto';
import {
  CreateDashboardAccountDto,
  CreateDashboardInvoiceDto,
  CreateDashboardPaymentDto,
  CreateDashboardReceiptDto,
  CreateDashboardRecordDto,
  CreateDashboardRegistrationInvoiceDto,
  DashboardAccountDto,
  DashboardAccountNextCodeDto,
  DashboardAccountingDocumentQueryDto,
  DashboardAccountsQueryDto,
  DashboardAccountsResponseDto,
  DashboardCurrencyDto,
  DashboardInvoiceDto,
  DashboardInvoicesQueryDto,
  DashboardInvoicesResponseDto,
  DashboardPackagePreviewQueryDto,
  DashboardParentRegistrationDto,
  DashboardParentRegistrationsQueryDto,
  DashboardPaymentDto,
  DashboardPaymentsResponseDto,
  DashboardPostingLookupDto,
  DashboardPostingLookupQueryDto,
  DashboardReceiptDto,
  DashboardReceiptsResponseDto,
  DashboardRecordDto,
  DashboardRecordsResponseDto,
  DashboardRegistrationPackagePreviewDto,
  DashboardRegistrationWithInvoiceDto,
  DashboardStatementDto,
  DashboardStatementQueryDto,
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

  @Get('accounts/roots')
  @ApiOperation({
    summary: 'List root accounts of the hierarchical chart of accounts',
  })
  @ApiOkResponse({ type: [DashboardAccountDto] })
  listRootAccounts(
    @Req() request: Request & { user: AuthenticatedSchool },
  ): Promise<DashboardAccountDto[]> {
    return this.dashboardAccountingService.listRootAccounts(request.user);
  }

  @Get('accounts/:id/children')
  @ApiOperation({
    summary: 'List direct children of a chart account (lazy tree loading)',
  })
  @ApiOkResponse({ type: [DashboardAccountDto] })
  listAccountChildren(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAccountDto[]> {
    return this.dashboardAccountingService.listAccountChildren(
      request.user,
      id,
    );
  }

  @Get('accounts/:id/next-code')
  @ApiOperation({
    summary:
      'Preview the next expected child code (read-only; backend allocates the final code)',
  })
  @ApiOkResponse({ type: DashboardAccountNextCodeDto })
  getNextChildCode(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardAccountNextCodeDto> {
    return this.dashboardAccountingService.getNextChildCode(request.user, id);
  }

  @Get('accounts/posting-lookup')
  @ApiOperation({
    summary:
      'Posting-only account autocomplete for transaction selectors (exact 8-digit non-group accounts of family 4 or 5, same school only)',
  })
  @ApiOkResponse({ type: [DashboardPostingLookupDto] })
  lookupPostingAccounts(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardPostingLookupQueryDto,
  ): Promise<DashboardPostingLookupDto[]> {
    return this.dashboardAccountingService.lookupPostingAccounts(
      request.user,
      query,
    );
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

  @Delete('accounts/:id')
  @ApiOperation({
    summary:
      'Delete an account (blocked when it has children or financial references)',
  })
  @ApiOkResponse({ type: Object })
  deleteAccount(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number }> {
    return this.dashboardAccountingService.deleteAccount(request.user, id);
  }

  @Post('accounts')
  @ApiOperation({
    summary:
      'Create a root or child chart account for this school (GENERAL anywhere, PERSON only under 4111)',
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
    summary:
      'Rename a GENERAL chart account / toggle its group designation (codes are immutable)',
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

  @Patch('receipts/:id')
  @ApiOperation({
    summary: 'Update a Receipt while preserving its number and register',
  })
  @ApiOkResponse({ type: DashboardReceiptDto })
  updateReceipt(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDashboardReceiptDto,
  ): Promise<DashboardReceiptDto> {
    return this.dashboardAccountingService.updateReceipt(request.user, id, dto);
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

  @Patch('payments/:id')
  @ApiOperation({
    summary: 'Update a Payment while preserving its number and register',
  })
  @ApiOkResponse({ type: DashboardPaymentDto })
  updatePayment(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDashboardPaymentDto,
  ): Promise<DashboardPaymentDto> {
    return this.dashboardAccountingService.updatePayment(request.user, id, dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List Invoice documents for this school' })
  @ApiOkResponse({ type: DashboardInvoicesResponseDto })
  listInvoices(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardInvoicesQueryDto,
  ): Promise<DashboardInvoicesResponseDto> {
    return this.dashboardAccountingService.listInvoices(request.user, query);
  }

  @Post('invoices')
  @ApiOperation({
    summary:
      'Create a manual Invoice for a parent (one register, one invoice, balanced journal)',
  })
  @ApiCreatedResponse({ type: DashboardInvoiceDto })
  createInvoice(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardInvoiceDto,
  ): Promise<DashboardInvoiceDto> {
    return this.dashboardAccountingService.createInvoice(request.user, dto);
  }

  @Get('invoices/parent-registrations')
  @ApiOperation({
    summary:
      'List active registrations of a parent for optional invoice line assignment',
  })
  @ApiOkResponse({ type: [DashboardParentRegistrationDto] })
  listParentRegistrations(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardParentRegistrationsQueryDto,
  ): Promise<DashboardParentRegistrationDto[]> {
    return this.dashboardAccountingService.listParentRegistrations(
      request.user,
      query.parentId,
    );
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get an Invoice document for this school' })
  @ApiOkResponse({ type: DashboardInvoiceDto })
  getInvoice(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardInvoiceDto> {
    return this.dashboardAccountingService.getInvoice(request.user, id);
  }

  @Get('records')
  @ApiOperation({ summary: 'List manual Record documents for this school' })
  @ApiOkResponse({ type: DashboardRecordsResponseDto })
  listRecords(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardAccountingDocumentQueryDto,
  ): Promise<DashboardRecordsResponseDto> {
    return this.dashboardAccountingService.listRecords(request.user, query);
  }

  @Post('records')
  @ApiOperation({
    summary:
      'Post a manual balanced Record (one register, one record, balanced journal)',
  })
  @ApiCreatedResponse({ type: DashboardRecordDto })
  createRecord(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardRecordDto,
  ): Promise<DashboardRecordDto> {
    return this.dashboardAccountingService.createRecord(request.user, dto);
  }

  @Get('records/:id')
  @ApiOperation({ summary: 'Get a manual Record document for this school' })
  @ApiOkResponse({ type: DashboardRecordDto })
  getRecord(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DashboardRecordDto> {
    return this.dashboardAccountingService.getRecord(request.user, id);
  }

  @Get('accounts/:id/statement')
  @ApiOperation({
    summary:
      'Statement of account from the journal with running balances grouped by currency',
  })
  @ApiOkResponse({ type: DashboardStatementDto })
  getAccountStatement(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Query() query: DashboardStatementQueryDto,
  ): Promise<DashboardStatementDto> {
    return this.dashboardAccountingService.getAccountStatement(
      request.user,
      id,
      query,
    );
  }

  @Post('registrations/with-invoice')
  @ApiOperation({
    summary:
      'Atomically create a Registration and its package Invoice (one register, one invoice, balanced journal)',
  })
  @ApiCreatedResponse({ type: DashboardRegistrationWithInvoiceDto })
  createRegistrationWithInvoice(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Body() dto: CreateDashboardRegistrationInvoiceDto,
  ): Promise<DashboardRegistrationWithInvoiceDto> {
    return this.dashboardAccountingService.createRegistrationWithInvoice(
      request.user,
      dto,
    );
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

  @Get('registration-packages/available-classes')
  listAvailablePackageClasses(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardPackageClassesQueryDto,
  ) {
    return this.accountingConfigService.listAvailableClasses(
      request.user,
      query.yearId,
    );
  }

  @Get('registration-packages/by-class/preview')
  getPackagePreview(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Query() query: DashboardPackagePreviewQueryDto,
  ): Promise<DashboardRegistrationPackagePreviewDto> {
    return this.dashboardAccountingService.getRegistrationPackagePreview(
      request.user,
      query.classId,
      query.yearId,
      query.studentId,
    );
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
    @Body() dto: SaveCompleteDashboardPackageDto,
  ) {
    return this.accountingConfigService.createCompletePackage(
      request.user,
      dto,
    );
  }

  @Patch('registration-packages/:id')
  updatePackage(
    @Req() request: Request & { user: AuthenticatedSchool },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveCompleteDashboardPackageDto,
  ) {
    return this.accountingConfigService.updateCompletePackage(
      request.user,
      id,
      dto,
    );
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

import {
  Body,
  Controller,
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
}

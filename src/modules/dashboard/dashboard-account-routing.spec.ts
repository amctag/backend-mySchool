import { VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardAccountingConfigService } from './dashboard-accounting-config.service';
import { DashboardAccountingController } from './dashboard-accounting.controller';
import { DashboardAccountingService } from './dashboard-accounting.service';

/**
 * Routing regression: static chart routes must never be captured by
 * `accounts/:id` + ParseIntPipe ("Validation failed (numeric string is
 * expected)" in the deployed Chart of Accounts page).
 */
describe('DashboardAccountingController account routing', () => {
  const allowAll = { canActivate: () => true };
  const accountingService = {
    listAccounts: jest.fn(),
    listRootAccounts: jest.fn().mockResolvedValue([]),
    listAccountChildren: jest.fn().mockResolvedValue([]),
    getAccount: jest.fn(),
    getNextChildCode: jest.fn(),
    createAccount: jest.fn(),
    updateAccount: jest.fn(),
    deleteAccount: jest.fn(),
  };
  const configService = {};

  async function app() {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardAccountingController],
      providers: [
        { provide: DashboardAccountingService, useValue: accountingService },
        {
          provide: DashboardAccountingConfigService,
          useValue: configService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAll)
      .overrideGuard(RolesGuard)
      .useValue(allowAll)
      .compile();
    const nestApp = moduleRef.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await nestApp.init();
    return nestApp;
  }

  it('routes GET /accounts/roots to listRootAccounts, not :id', async () => {
    const nestApp = await app();
    try {
      const response = await request(nestApp.getHttpServer()).get(
        '/api/v1/dashboard/accounting/accounts/roots',
      );
      expect(response.status).toBe(200);
      expect(accountingService.listRootAccounts).toHaveBeenCalled();
    } finally {
      await nestApp.close();
    }
  });

  it('still routes numeric :id to getAccount', async () => {
    accountingService.getAccount.mockResolvedValueOnce({ id: 12 });
    const nestApp = await app();
    try {
      const response = await request(nestApp.getHttpServer()).get(
        '/api/v1/dashboard/accounting/accounts/12',
      );
      expect(response.status).toBe(200);
      expect(accountingService.getAccount).toHaveBeenCalled();
    } finally {
      await nestApp.close();
    }
  });

  it('still rejects non-numeric :id with 400', async () => {
    const nestApp = await app();
    try {
      const response = await request(nestApp.getHttpServer()).get(
        '/api/v1/dashboard/accounting/accounts/abc',
      );
      expect(response.status).toBe(400);
    } finally {
      await nestApp.close();
    }
  });

  it('routes children and next-code under numeric :id', async () => {
    const nestApp = await app();
    try {
      const children = await request(nestApp.getHttpServer()).get(
        '/api/v1/dashboard/accounting/accounts/12/children',
      );
      expect(children.status).toBe(200);
      expect(accountingService.listAccountChildren).toHaveBeenCalled();
      const nextCode = await request(nestApp.getHttpServer()).get(
        '/api/v1/dashboard/accounting/accounts/12/next-code',
      );
      expect(nextCode.status).toBe(200);
      expect(accountingService.getNextChildCode).toHaveBeenCalled();
    } finally {
      await nestApp.close();
    }
  });
});

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DashboardAccountingController } from './dashboard-accounting.controller';
import { DashboardAccountingService } from './dashboard-accounting.service';
import { DashboardAccountingConfigService } from './dashboard-accounting-config.service';
import { createValidationPipe } from '../../config/validation';

describe('DashboardAccountingController posting-lookup routing', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardAccountingController],
      providers: [
        {
          provide: DashboardAccountingService,
          useValue: {
            lookupPostingAccounts: jest.fn(() => Promise.resolve([])),
          },
        },
        { provide: DashboardAccountingConfigService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('routes /accounts/posting-lookup to lookupPostingAccounts (not :id)', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/dashboard/accounting/accounts/posting-lookup?family=4&search=maya&limit=20',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

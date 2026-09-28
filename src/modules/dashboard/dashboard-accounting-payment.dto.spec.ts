import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDashboardPaymentDto } from './dto/dashboard-accounting.dto';

const validPayment = {
  accountId: 40,
  currencyId: 1,
  idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  allocations: [
    { accountId: 31, amount: 300 },
    { accountId: 32, amount: 700, description: 'Bank transfer' },
  ],
};

describe('CreateDashboardPaymentDto contract', () => {
  it('accepts multiple source allocations without a top-level amount', async () => {
    const dto = plainToInstance(CreateDashboardPaymentDto, validPayment);
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects zero and negative source allocations', async () => {
    for (const amount of [0, -1]) {
      const dto = plainToInstance(CreateDashboardPaymentDto, {
        ...validPayment,
        allocations: [{ accountId: 31, amount }],
      });
      await expect(validate(dto)).resolves.not.toEqual([]);
    }
  });
});

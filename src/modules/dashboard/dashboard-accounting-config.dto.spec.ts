import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveDashboardItemDto } from './dto/dashboard-accounting-config.dto';

describe('SaveDashboardItemDto price contract', () => {
  it('accepts a two-decimal non-negative price', async () => {
    const dto = plainToInstance(SaveDashboardItemDto, {
      name: 'Registration',
      itemTypeId: 2,
      price: '100.25',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([-0.01, 1.001])('rejects invalid money value %s', async (price) => {
    const dto = plainToInstance(SaveDashboardItemDto, {
      name: 'Registration',
      itemTypeId: 2,
      price,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'price')).toBe(true);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateDashboardReceiptDto } from './dto/dashboard-accounting.dto';

function messages(errors: ValidationError[]): string[] {
  const out: string[] = [];
  const walk = (list: ValidationError[], prefix: string) => {
    for (const error of list) {
      const path = prefix ? `${prefix}.${error.property}` : error.property;
      for (const message of Object.values(error.constraints ?? {})) {
        out.push(`${path}: ${message}`);
      }
      if (error.children?.length) {
        walk(error.children, path);
      }
    }
  };
  walk(errors, '');
  return out;
}

async function validateReceipt(
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(CreateDashboardReceiptDto, body as object);
  return messages(await validate(dto));
}

const bankCashReceipt = {
  parentId: 7,
  currencyId: 1,
  description: 'Tuition',
  idempotencyKey: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  allocations: [
    { accountId: 32, amount: 1200, description: 'Bank deposit' },
    { accountId: 31, amount: 300, description: 'Cash payment' },
  ],
};

describe('CreateDashboardReceiptDto contract', () => {
  it('accepts the Phase 2C payload without a legacy top-level amount', async () => {
    await expect(validateReceipt(bankCashReceipt)).resolves.toEqual([]);
  });

  it('does not require a top-level amount', async () => {
    const { ...withoutAmount } = bankCashReceipt;
    const errors = await validateReceipt(withoutAmount);
    expect(errors.filter((message) => message.includes('amount:'))).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('coerces numeric strings from form inputs to numbers', async () => {
    const errors = await validateReceipt({
      ...bankCashReceipt,
      allocations: [
        { accountId: 32, amount: '1200' },
        { accountId: 31, amount: '300' },
      ],
    });
    expect(errors).toEqual([]);
  });

  it('rejects a zero allocation amount', async () => {
    const errors = await validateReceipt({
      ...bankCashReceipt,
      allocations: [{ accountId: 32, amount: 0 }],
    });
    expect(errors.some((message) => message.includes('amount'))).toBe(true);
  });

  it('rejects a negative allocation amount', async () => {
    const errors = await validateReceipt({
      ...bankCashReceipt,
      allocations: [{ accountId: 32, amount: -50 }],
    });
    expect(errors.some((message) => message.includes('amount'))).toBe(true);
  });

  it('rejects non-numeric allocation amounts', async () => {
    const errors = await validateReceipt({
      ...bankCashReceipt,
      allocations: [{ accountId: 32, amount: 'a lot' }],
    });
    expect(errors.some((message) => message.includes('amount'))).toBe(true);
  });

  it('rejects a missing allocation amount', async () => {
    const errors = await validateReceipt({
      ...bankCashReceipt,
      allocations: [{ accountId: 32 }],
    });
    expect(errors.some((message) => message.includes('amount'))).toBe(true);
  });

  it('rejects an empty allocation list', async () => {
    const errors = await validateReceipt({
      ...bankCashReceipt,
      allocations: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

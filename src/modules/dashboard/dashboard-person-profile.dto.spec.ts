import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDashboardDirectorDto } from './dto/create-dashboard-director.dto';
import { CreateDashboardTeacherDto } from './dto/create-dashboard-teacher.dto';
import { REGISTER_ID_RANGE_MESSAGE } from '../../common/constants/database-limits';

const validPerson = {
  firstName: 'Sara',
  lastName: 'Haddad',
  phoneNumber: '+961 71 000 010',
};

function constraintsOf(
  errors: Awaited<ReturnType<typeof validate>>,
  property: string,
): string[] {
  const match = errors.find((error) => error.property === property);
  return match?.constraints ? Object.values(match.constraints) : [];
}

describe('Dashboard person profile DTO validation', () => {
  it('accepts a valid teacher and a valid director payload', async () => {
    for (const Dto of [CreateDashboardTeacherDto, CreateDashboardDirectorDto]) {
      const dto = plainToInstance(Dto, {
        ...validPerson,
        registerId: 2045,
        identityNumber: '0012345678901234567890',
        email: 'sara@example.com',
      });
      await expect(validate(dto)).resolves.toEqual([]);
    }
  });

  it('rejects a register id larger than the INT4 column limit', async () => {
    for (const Dto of [CreateDashboardTeacherDto, CreateDashboardDirectorDto]) {
      const dto = plainToInstance(Dto, {
        ...validPerson,
        registerId: 111222111222,
      });
      const errors = await validate(dto);

      expect(constraintsOf(errors, 'registerId')).toContain(
        REGISTER_ID_RANGE_MESSAGE,
      );
    }
  });

  it('accepts the largest register id the column can store', async () => {
    const dto = plainToInstance(CreateDashboardTeacherDto, {
      ...validPerson,
      registerId: 2_147_483_647,
    });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects zero and negative register ids', async () => {
    for (const registerId of [0, -1]) {
      const dto = plainToInstance(CreateDashboardTeacherDto, {
        ...validPerson,
        registerId,
      });
      const errors = await validate(dto);
      expect(constraintsOf(errors, 'registerId')).toContain(
        REGISTER_ID_RANGE_MESSAGE,
      );
    }
  });

  it('keeps identity numbers as strings without a digit limit', async () => {
    const dto = plainToInstance(CreateDashboardTeacherDto, {
      ...validPerson,
      identityNumber: '000123456789012345678901234567890',
    });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects values longer than the persons column limits', async () => {
    const dto = plainToInstance(CreateDashboardTeacherDto, {
      ...validPerson,
      phoneNumber: '1'.repeat(51),
      identityNumber: '1'.repeat(51),
    });
    const errors = await validate(dto);

    expect(constraintsOf(errors, 'phoneNumber')).not.toEqual([]);
    expect(constraintsOf(errors, 'identityNumber')).not.toEqual([]);
  });

  it('requires a first name, family name, and phone number', async () => {
    const dto = plainToInstance(CreateDashboardDirectorDto, {});
    const errors = await validate(dto);

    expect(constraintsOf(errors, 'firstName')).not.toEqual([]);
    expect(constraintsOf(errors, 'lastName')).not.toEqual([]);
    expect(constraintsOf(errors, 'phoneNumber')).not.toEqual([]);
  });

  it('rejects an invalid email address', async () => {
    const dto = plainToInstance(CreateDashboardDirectorDto, {
      ...validPerson,
      email: 'not-an-email',
    });
    const errors = await validate(dto);

    expect(constraintsOf(errors, 'email')).not.toEqual([]);
  });
});

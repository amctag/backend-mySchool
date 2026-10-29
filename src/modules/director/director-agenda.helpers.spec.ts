import { BadRequestException } from '@nestjs/common';
import {
  DRAFT_PUBLISHED_DATE,
  normalizeAgendaTime,
  parseAgendaDate,
  prismaErrorCode,
  resolveAgendaAttachment,
} from './director-agenda.helpers';

describe('parseAgendaDate', () => {
  it.each([
    ['2026-10-29', '2026-10-29T00:00:00.000Z'],
    ['2026-10-29T00:00:00.000Z', '2026-10-29T00:00:00.000Z'],
    // Dart `DateTime(2026,10,29).toIso8601String()` has no timezone suffix.
    // This is what the Flutter client used to send, and what Prisma rejects.
    ['2026-10-29T00:00:00.000', '2026-10-29T00:00:00.000Z'],
    ['2026-10-29T23:59:59+03:00', '2026-10-29T00:00:00.000Z'],
    ['2028-02-29', '2028-02-29T00:00:00.000Z'],
  ])('accepts %s', (input, expected) => {
    expect(parseAgendaDate(input).toISOString()).toBe(expected);
  });

  it.each(['', 'abc', '29/10/2026', '2026-13-01', '2026-02-30', '2027-02-29'])(
    'rejects %p with 400',
    (input) => {
      expect(() => parseAgendaDate(input)).toThrow(BadRequestException);
    },
  );
});

describe('normalizeAgendaTime', () => {
  it('normalizes and defaults', () => {
    expect(normalizeAgendaTime('09:30')).toBe('09:30');
    expect(normalizeAgendaTime('09:30:15')).toBe('09:30');
    expect(normalizeAgendaTime(undefined)).toBeUndefined();
    expect(normalizeAgendaTime('')).toBeUndefined();
  });
  it('rejects invalid values', () => {
    expect(() => normalizeAgendaTime('25:00')).toThrow(BadRequestException);
    expect(() => normalizeAgendaTime('9am')).toThrow(BadRequestException);
  });
});

describe('resolveAgendaAttachment (NOT NULL columns)', () => {
  it('keeps when omitted', () => expect(resolveAgendaAttachment(undefined, 'old')).toBe('old'));
  it('removes with empty string', () => expect(resolveAgendaAttachment('', 'old')).toBe(''));
  it('removes with null and never returns null', () => expect(resolveAgendaAttachment(null, 'old')).toBe(''));
  it('replaces and trims', () => expect(resolveAgendaAttachment(' https://n/x.pdf ', 'old')).toBe('https://n/x.pdf'));
});

describe('draft sentinel', () => {
  it('is inside the MySQL TIMESTAMP range (> 1970-01-01 00:00:00 UTC)', () => {
    expect(DRAFT_PUBLISHED_DATE.getTime()).toBeGreaterThan(0);
  });
});

describe('prismaErrorCode', () => {
  it('reads known request errors only', () => {
    expect(prismaErrorCode({ name: 'PrismaClientKnownRequestError', code: 'P2000' })).toBe('P2000');
    expect(prismaErrorCode(new Error('x'))).toBeUndefined();
    expect(prismaErrorCode(null)).toBeUndefined();
  });
});

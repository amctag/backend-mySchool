import { BadRequestException } from '@nestjs/common';

/**
 * `agendas.published_date` is NOT NULL, so drafts need a placeholder value.
 * `status` (0 = draft, 1 = published) is the source of truth; this value
 * must never be interpreted as a real publication date.
 */
export const DRAFT_PUBLISHED_DATE = new Date('1970-01-01T00:00:01.000Z');

export const AGENDA_STATUS_DRAFT = 0;
export const AGENDA_STATUS_PUBLISHED = 1;

/**
 * Attachments are NOT NULL columns.
 *  - `undefined` -> keep the stored value
 *  - `null` / `''` -> remove the attachment (stored as an empty string)
 *  - any other string -> replace (trimmed)
 */
export function resolveAgendaAttachment(
  value: string | null | undefined,
  existing: string,
): string {
  if (value === undefined) return existing;
  if (value === null) return '';
  return value.trim();
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;

/**
 * Accepts `YYYY-MM-DD` or an ISO-8601 date-time and returns that CALENDAR DAY
 * at 00:00:00 UTC. Only the date part is used so a client in UTC+3 sending
 * local midnight can never shift the agenda onto the previous day. Handing the
 * raw string to Prisma instead throws a validation error (HTTP 500) for
 * date-only values and for date-times without a timezone.
 */
export function parseAgendaDate(value: string): Date {
  const match = DATE_RE.exec((value ?? '').trim());
  if (!match) {
    throw new BadRequestException('date must be YYYY-MM-DD or an ISO-8601 date');
  }
  const [year, month, day] = [match[1], match[2], match[3]].map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    throw new BadRequestException('date must be a valid calendar date');
  }
  return result;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function normalizeAgendaTime(value: string | undefined | null): string | undefined {
  if (value == null || value.trim() === '') return undefined;
  const match = TIME_RE.exec(value.trim());
  if (!match) throw new BadRequestException('time must be HH:mm');
  return `${match[1]}:${match[2]}`;
}

/** Date -> `YYYY-MM-DD` (UTC), empty string when missing. */
export function toDateOnly(value: Date | null | undefined): string {
  return value ? value.toISOString().split('T')[0] : '';
}

/** Prisma known errors are duck-typed so this file has no @prisma/client dependency. */
export function prismaErrorCode(error: unknown): string | undefined {
  const e = error as { name?: string; code?: unknown } | null;
  return e && e.name === 'PrismaClientKnownRequestError' && typeof e.code === 'string'
    ? e.code
    : undefined;
}

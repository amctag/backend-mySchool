/**
 * Numeric limits of the PostgreSQL column types used by the Prisma schema.
 *
 * Prisma maps `Int` to PostgreSQL `INT4`, which cannot store values outside
 * this range. Sending a larger value from a form makes PostgreSQL raise an
 * out-of-range error and Prisma reports it as `P2020`. We validate against the
 * real column limits before the write so clients get a clear 400 instead of a
 * generic 500.
 */
export const PG_INT4_MIN = -2_147_483_648;
export const PG_INT4_MAX = 2_147_483_647;

/**
 * `persons.register_id` is an `INT4` column (a numeric registration number,
 * not an arithmetic value). 1..INT4_MAX is the actual supported range.
 */
export const REGISTER_ID_MIN = 1;
export const REGISTER_ID_MAX = PG_INT4_MAX;

export const REGISTER_ID_RANGE_MESSAGE =
  'Register ID must be a whole number between 1 and 2,147,483,647.';

/**
 * Reads Prisma's `meta.field_name` only when it is a string, so an unexpected
 * meta shape can never stringify to "[object Object]".
 */
export function readPrismaFieldName(meta: unknown): string {
  if (!meta || typeof meta !== 'object' || !('field_name' in meta)) {
    return '';
  }

  const fieldName = (meta as { field_name?: unknown }).field_name;
  return typeof fieldName === 'string' ? fieldName : '';
}

/**
 * Parses a numeric query-string value only when it fits in an INT4 column.
 * Used for id filters, so an oversized search value can never reach Prisma.
 */
export function parseInt4FilterValue(
  value?: string | null,
): number | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > PG_INT4_MAX) {
    return undefined;
  }

  return parsed;
}

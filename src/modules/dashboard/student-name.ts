export type ParentPersonRow = {
  firstName?: string | null;
  lastName?: string | null;
} | null;

/**
 * Canonical student display name.
 *
 * Always `student first name + father's first name + family name`, where the
 * father names come from the linked Parent record
 * (`students.parent_id → parents.person_id → persons`), never from the
 * student's own `persons.middle_name` / `persons.last_name`.
 *
 * Domain note: `students.parent_id` has no relationship-type discriminator,
 * but every signal in this codebase treats the linked Parent as the father —
 * the student stores the mother separately (`mother_name/mother_family/
 * mother_phone`) and new students get `middle_name = parent first name`.
 * If a non-father guardian is ever linked, it will be displayed as the
 * father; there is currently no schema support to distinguish that case.
 */
export type StudentNameParts = {
  studentFirstName?: string | null;
  fatherFirstName?: string | null;
  familyName?: string | null;
};

export type ResolvedStudentName = {
  studentFirstName: string | null;
  fatherFirstName: string | null;
  familyName: string | null;
  studentFullName: string;
};

export function formatStudentFullName(parts: StudentNameParts): string {
  return [parts.studentFirstName, parts.fatherFirstName, parts.familyName]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

export function toStudentName(
  studentPerson: { firstName?: string | null },
  parentPerson?: ParentPersonRow,
): ResolvedStudentName {
  const studentFirstName = studentPerson.firstName?.trim() || null;
  // Never fall back to the student's middle_name/last_name here: missing
  // father or family names stay missing instead of being invented.
  const fatherFirstName = parentPerson?.firstName?.trim() || null;
  const familyName = parentPerson?.lastName?.trim() || null;
  return {
    studentFirstName,
    fatherFirstName,
    familyName,
    studentFullName: formatStudentFullName({
      studentFirstName,
      fatherFirstName,
      familyName,
    }),
  };
}

/**
 * Nested Prisma select loading the linked father's names alongside the
 * student person in a single query (no N+1). Spread under a `student`
 * select/include, e.g. `student: { select: { ..., ...studentFatherSelect } }`.
 */
export const studentFatherSelect = {
  parent: {
    select: {
      person: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
} as const;

export type StudentFatherRow = {
  person: { firstName: string | null };
  parent?: {
    person: { firstName: string | null; lastName: string | null };
  } | null;
};

export function studentNameFromRow(row: StudentFatherRow): ResolvedStudentName {
  return toStudentName(row.person, row.parent?.person ?? null);
}

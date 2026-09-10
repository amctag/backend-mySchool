export function formatFullName(person: {
  firstName: string;
  middleName: string;
  lastName: string;
}): string {
  return [person.firstName, person.middleName, person.lastName]
    .filter(Boolean)
    .join(' ');
}

export function formatClassLabel(
  className: string,
  sectionTitle: string,
): string {
  return `${className} - Section ${sectionTitle}`;
}

export function parseDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

export function monthDateRange(month: string): { gte: Date; lte: Date } {
  const [year, monthNum] = month.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(year, monthNum - 1, 1)),
    lte: new Date(Date.UTC(year, monthNum, 0)),
  };
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(date: Date): string {
  return date.toISOString();
}

export function periodClock(position: number): {
  startTime: string;
  endTime: string;
} {
  const period = Math.max(1, position);
  const startMinutes = 8 * 60 + (period - 1) * 50;
  return {
    startTime: formatMinutes(startMinutes),
    endTime: formatMinutes(startMinutes + 45),
  };
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function todayUtcDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

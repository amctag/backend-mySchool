export function formatFullName(person: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}): string {
  const parts: string[] = [person.firstName];
  if (person.middleName) {
    parts.push(person.middleName);
  }
  parts.push(person.lastName);
  return parts.join(' ');
}

export function formatClassLabel(className: string, sectionTitle: string): string {
  return `${className} - ${sectionTitle}`;
}
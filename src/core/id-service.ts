export function toSlug(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'untitled';
}

export function compactTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function createRecordId(
  prefix: string,
  title: string,
  date = new Date(),
  discriminator?: string,
): string {
  const suffix = discriminator ? `_${toSlug(discriminator).replaceAll('-', '_')}` : '';
  return `${prefix}_${compactTimestamp(date)}_${toSlug(title).replaceAll('-', '_')}${suffix}`;
}

export function createDatedFilename(title: string, suffix: string, date = new Date()): string {
  return `${compactTimestamp(date)}-${toSlug(title)}${suffix}`;
}

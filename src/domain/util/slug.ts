import type { ISODate } from '../types';

const MAX_SLUG_LENGTH = 60;

/** ASCII slug for file names: lowercase, no diacritics, hyphen-separated. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
  return slug || 'project';
}

/** e.g. facet-review_my-review_2026-09-30.json */
export function exportFileName(title: string, exportedAt: ISODate): string {
  return `facet-review_${slugify(title)}_${exportedAt.slice(0, 10)}.json`;
}

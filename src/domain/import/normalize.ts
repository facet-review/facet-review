import type { CslItem, CslName } from '../types';

const DOI_PREFIX = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i;
const DOI_PATTERN = /^10\.\d+\/\S+$/;

/**
 * Normalised DOI for matching: lower case, without resolver prefix, "doi:" label,
 * PubMed's "[doi]" suffix or trailing punctuation. Undefined if not a DOI.
 */
export function normalizeDoi(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const doi = value
    .trim()
    .replace(DOI_PREFIX, '')
    .replace(/\s*\[doi\]$/i, '')
    .replace(/[.,;]+$/, '')
    .trim()
    .toLowerCase();
  return DOI_PATTERN.test(doi) ? doi : undefined;
}

/** PubMed identifier: digits only. */
export function normalizePmid(value: string | undefined): string | undefined {
  const match = value?.trim().match(/^\D*?(\d{1,9})$/);
  return match?.[1];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

/** Decodes HTML entities that some exporters leave in titles and abstracts. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
      return Number.isFinite(code) ? String.fromCodePoint(code) : entity;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

/** German umlauts are transliterated (as in all-caps databases), other accents dropped. */
const TRANSLITERATION: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ß: 'ss',
  ẞ: 'SS',
};

/** Comparable form of a title or name: entities decoded, ASCII, lower case, no punctuation. */
export function normalizeTitle(value: string | undefined): string {
  if (!value) return '';
  return decodeEntities(value)
    .replace(/[äöüÄÖÜßẞ]/g, (char) => TRANSLITERATION[char] ?? char)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const INITIALS = /^[A-Z](?:[A-Z]|[.-])*\.?$/;

/**
 * Splits a personal name as written in exports: "Family, Given[, Suffix]" or
 * MEDLINE/Scopus style "Family Initials". Everything else stays literal.
 */
export function parsePersonName(value: string): CslName | undefined {
  const name = value.trim();
  if (!name) return undefined;
  if (name.includes(',')) {
    const [family = '', given, ...rest] = name.split(',').map((part) => part.trim());
    const result: CslName = { family };
    if (given) result.given = given;
    if (rest.length > 0) result.suffix = rest.join(', ');
    return result;
  }
  const tokens = name.split(/\s+/);
  const last = tokens.at(-1) ?? '';
  if (tokens.length >= 2 && INITIALS.test(last)) {
    return { family: tokens.slice(0, -1).join(' '), given: last };
  }
  return { literal: name };
}

/** Key for comparing first authors: surname without accents, spaces or hyphens. */
export function firstAuthorKey(csl: Pick<CslItem, 'author'>): string | undefined {
  const first = csl.author?.[0];
  const surname = first?.family ?? first?.literal;
  const key = normalizeTitle(surname).replace(/ /g, '');
  return key || undefined;
}

export function yearOf(csl: Pick<CslItem, 'issued'>): number | undefined {
  const year = Number(csl.issued?.['date-parts']?.[0]?.[0]);
  return Number.isInteger(year) && year > 0 ? year : undefined;
}

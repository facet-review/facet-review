import type { CslItem, CslName } from '../types';

/** Inverse of the import mapping in domain/import/ris.ts. */
const RIS_TYPES: Record<string, string> = {
  'article-journal': 'JOUR',
  'article-magazine': 'MGZN',
  'article-newspaper': 'NEWS',
  book: 'BOOK',
  chapter: 'CHAP',
  'paper-conference': 'CPAPER',
  thesis: 'THES',
  report: 'RPRT',
  webpage: 'ELEC',
  'post-weblog': 'BLOG',
  dataset: 'DATA',
};

export interface RisInput {
  csl: CslItem;
  doi?: string;
  /** No standard RIS tag exists; written as note "PMID: …". */
  pmid?: string;
  notes?: string[];
}

/** "Family, Given"; a family name alone keeps its comma so it stays a family name. */
const name = (n: CslName) => {
  if (n.literal) return n.literal;
  if (n.family && !n.given && !n.suffix) return `${n.family},`;
  return [n.family, n.given, n.suffix].filter(Boolean).join(', ');
};
/** RIS is line-based: no line breaks inside a value. */
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();
const pad = (n: number | string | undefined) => String(n ?? '').padStart(2, '0');

export function toRisRecord(record: RisInput): string {
  const { csl } = record;
  const lines: string[] = [];
  const add = (tag: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const text = oneLine(String(value));
    if (text) lines.push(`${tag}  - ${text}`);
  };

  lines.push(`TY  - ${RIS_TYPES[csl.type ?? ''] ?? 'GEN'}`);
  add('TI', csl.title);
  for (const author of csl.author ?? []) add('AU', name(author));
  for (const editor of csl.editor ?? []) add('A2', name(editor));
  const [year, month, day] = csl.issued?.['date-parts']?.[0] ?? [];
  add('PY', year);
  if (year && month) add('DA', `${year}/${pad(month)}/${day ? pad(day) : ''}/`);
  add('T2', csl['container-title']);
  add('J2', csl['container-title-short']);
  add('VL', csl.volume);
  add('IS', csl.issue);
  const [start, end] = (csl.page ?? '').split(/[-–]/);
  add('SP', start);
  add('EP', end);
  add('DO', record.doi ?? csl.DOI);
  add('SN', csl.ISSN);
  add('UR', csl.URL);
  add('AB', csl.abstract);
  for (const keyword of (csl.keyword ?? '').split(/,\s*/)) add('KW', keyword);
  add('LA', csl.language);
  add('PB', csl.publisher);
  if (record.pmid) add('N1', `PMID: ${record.pmid}`);
  for (const note of record.notes ?? []) add('N1', note);
  lines.push('ER  - ', '');
  return lines.join('\r\n');
}

/** RIS file (UTF-8, CRLF) – readable by Zotero, Citavi, EndNote and this app. */
export function toRis(records: readonly RisInput[]): string {
  return records.map(toRisRecord).join('\r\n');
}

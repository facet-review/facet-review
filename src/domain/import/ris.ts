import type { CslName, ImportWarning } from '../types';
import { cleanText, compactCsl, mostPrecise, pages } from './fields';
import { normalizeDoi, normalizePmid, parsePersonName } from './normalize';
import type { ParsedRecord, ParseResult } from './types';

const TAG = /^([A-Z][A-Z0-9]) {2}-(?: (.*))?$/;

const TYPES: Record<string, string> = {
  JOUR: 'article-journal',
  JFULL: 'article-journal',
  EJOUR: 'article-journal',
  MGZN: 'article-magazine',
  NEWS: 'article-newspaper',
  BOOK: 'book',
  EBOOK: 'book',
  EDBOOK: 'book',
  CHAP: 'chapter',
  ECHAP: 'chapter',
  CONF: 'paper-conference',
  CPAPER: 'paper-conference',
  THES: 'thesis',
  RPRT: 'report',
  ELEC: 'webpage',
  WEB: 'webpage',
  BLOG: 'post-weblog',
  DATA: 'dataset',
  DBASE: 'dataset',
  GEN: 'article',
};

/** Scopus sometimes exports internal labels such as "label.ris.referenceType.BOOK_CHAPTER". */
const LABEL_TYPES: Record<string, string> = {
  ARTICLE: 'article-journal',
  REVIEW: 'article-journal',
  SHORT_SURVEY: 'article-journal',
  EDITORIAL: 'article-journal',
  LETTER: 'article-journal',
  NOTE: 'article-journal',
  ERRATUM: 'article-journal',
  BOOK: 'book',
  BOOK_CHAPTER: 'chapter',
  CONFERENCE_PAPER: 'paper-conference',
  CONFERENCE_REVIEW: 'paper-conference',
};

interface OpenRecord {
  line: number;
  lines: string[];
  fields: Map<string, string[]>;
  lastTag?: string;
}

/** RIS (Scopus, ProQuest, EBSCO, Web of Science, Zotero, …). */
export function parseRis(text: string): ParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const records: ParsedRecord[] = [];
  const warnings: ImportWarning[] = [];
  let open: OpenRecord | undefined;

  const close = (complete: boolean) => {
    if (!open) return;
    if (!complete) warnings.push({ code: 'missingEnd', line: open.line });
    records.push(toRecord(open, warnings));
    open = undefined;
  };

  lines.forEach((content, index) => {
    const lineNumber = index + 1;
    const match = TAG.exec(content);
    if (!match) {
      if (content.trim() === '') return;
      if (open?.lastTag) {
        const values = open.fields.get(open.lastTag)!;
        values[values.length - 1] = `${values.at(-1) ?? ''} ${content.trim()}`.trim();
        open.lines.push(content);
      } else {
        warnings.push({ code: 'textOutsideRecord', line: lineNumber });
      }
      return;
    }
    const [, tag = '', value = ''] = match;
    if (tag === 'TY') {
      close(false);
      open = { line: lineNumber, lines: [], fields: new Map() };
    }
    if (!open) {
      warnings.push({ code: 'textOutsideRecord', line: lineNumber });
      return;
    }
    open.lines.push(content);
    if (tag === 'ER') {
      close(true);
      return;
    }
    const values = open.fields.get(tag) ?? [];
    values.push(value.trim());
    open.fields.set(tag, values);
    open.lastTag = tag;
  });
  close(false);

  if (records.length === 0) warnings.push({ code: 'noRecords' });
  return { records, warnings };
}

function toRecord(open: OpenRecord, warnings: ImportWarning[]): ParsedRecord {
  const all = (tag: string) => (open.fields.get(tag) ?? []).filter((value) => value !== '');
  const first = (...tags: string[]) => tags.map((tag) => all(tag)[0]).find(Boolean);
  const names = (...tags: string[]) =>
    tags
      .flatMap(all)
      .map(parsePersonName)
      .filter((name): name is CslName => name !== undefined);

  const rawType = first('TY') ?? '';
  let type = TYPES[rawType];
  if (!type) {
    type = LABEL_TYPES[rawType.replace(/^label\.ris\.referenceType\./, '')] ?? 'article';
    warnings.push({ code: 'unknownType', line: open.line, detail: rawType });
  }

  const title = cleanText(first('TI', 'T1', 'CT', type === 'book' ? 'BT' : ''));
  if (!title) warnings.push({ code: 'missingTitle', line: open.line });

  const doiValue = first('DO');
  const doi =
    normalizeDoi(doiValue) ?? normalizeDoi(all('UR').find((url) => /doi\.org\//i.test(url)));
  const database = first('DB') ?? '';
  const pmid = /scopus/i.test(database)
    ? normalizePmid(first('C2'))
    : /pubmed|medline/i.test(database)
      ? normalizePmid(first('AN'))
      : undefined;

  const container = cleanText(first('T2', 'JF', 'JO', 'JA', 'J2', type === 'chapter' ? 'BT' : ''));
  const short = cleanText(first('J2', 'JA'));
  const abstract = cleanText(['AB', 'N2'].flatMap(all).join(' '));

  const csl = compactCsl({
    type,
    title,
    author: names('AU', 'A1'),
    editor: names('A2', 'ED'),
    issued: mostPrecise(first('PY'), first('Y1'), first('DA')),
    'container-title': container,
    'container-title-short': short !== container ? short : undefined,
    volume: first('VL'),
    issue: first('IS'),
    page: pages(first('SP'), first('EP')),
    DOI: doiValue && doi ? doiValue : doi,
    PMID: pmid,
    ISSN: first('SN'),
    URL: first('UR'),
    abstract,
    keyword: all('KW').join(', ') || undefined,
    language: first('LA'),
    publisher: cleanText(first('PB')),
  });

  return compactRecord({ csl, raw: open.lines.join('\n'), line: open.line, doi, pmid });
}

function compactRecord(record: ParsedRecord): ParsedRecord {
  if (record.doi === undefined) delete record.doi;
  if (record.pmid === undefined) delete record.pmid;
  return record;
}

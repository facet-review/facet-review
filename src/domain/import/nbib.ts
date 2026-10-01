import type { CslName, ImportWarning } from '../types';
import { cleanText, compactCsl, parseIssued } from './fields';
import { normalizeDoi, normalizePmid, parsePersonName } from './normalize';
import type { ParsedRecord, ParseResult } from './types';

const TAG = /^([A-Z]{2,4}) {0,2}- (.*)$/;
const CONTINUATION = /^\s{2,}\S/;

interface OpenRecord {
  line: number;
  lines: string[];
  fields: Map<string, string[]>;
  lastTag?: string;
}

/** PubMed / MEDLINE format (.nbib, .txt). Records start with "PMID-". */
export function parseNbib(text: string): ParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const records: ParsedRecord[] = [];
  const warnings: ImportWarning[] = [];
  let open: OpenRecord | undefined;

  const close = () => {
    if (open) records.push(toRecord(open, warnings));
    open = undefined;
  };

  lines.forEach((content, index) => {
    const lineNumber = index + 1;
    if (content.trim() === '') return;
    const match = TAG.exec(content);
    if (match?.[1] === 'PMID') {
      close();
      open = { line: lineNumber, lines: [], fields: new Map() };
    }
    if (!open) {
      warnings.push({ code: 'textOutsideRecord', line: lineNumber });
      return;
    }
    open.lines.push(content);
    if (match) {
      const [, tag = '', value = ''] = match;
      const values = open.fields.get(tag) ?? [];
      values.push(value.trim());
      open.fields.set(tag, values);
      open.lastTag = tag;
    } else if (CONTINUATION.test(content) && open.lastTag) {
      const values = open.fields.get(open.lastTag)!;
      values[values.length - 1] = `${values.at(-1) ?? ''} ${content.trim()}`.trim();
    } else {
      warnings.push({ code: 'unreadableLine', line: lineNumber });
    }
  });
  close();

  if (records.length === 0) warnings.push({ code: 'noRecords' });
  return { records, warnings };
}

function toRecord(open: OpenRecord, warnings: ImportWarning[]): ParsedRecord {
  const all = (tag: string) => (open.fields.get(tag) ?? []).filter((value) => value !== '');
  const first = (tag: string) => all(tag)[0];
  const names = (tag: string) =>
    all(tag)
      .map(parsePersonName)
      .filter((name): name is CslName => name !== undefined);

  // Translated titles are given in brackets: "[Original title in English]."
  const title = cleanText(first('TI'))?.replace(/^\[(.*)\](\.?)$/, '$1$2');
  if (!title) warnings.push({ code: 'missingTitle', line: open.line });

  const doiValue = [...all('LID'), ...all('AID')].find((value) => /\[doi\]$/i.test(value));
  const doi = normalizeDoi(doiValue);
  const pmid = normalizePmid(first('PMID'));
  const fullJournal = cleanText(first('JT'));
  const shortJournal = cleanText(first('TA'));
  const authors = all('FAU').length > 0 ? names('FAU') : names('AU');

  const csl = compactCsl({
    type: 'article-journal',
    title,
    author: authors,
    issued: parseIssued(first('DP')),
    'container-title': fullJournal ?? shortJournal,
    'container-title-short': fullJournal ? shortJournal : undefined,
    volume: first('VI'),
    issue: first('IP'),
    page: first('PG'),
    DOI: doi,
    PMID: pmid,
    abstract: cleanText(all('AB').join(' ')),
    language: first('LA'),
  });

  const record: ParsedRecord = { csl, raw: open.lines.join('\n'), line: open.line };
  if (doi) record.doi = doi;
  if (pmid) record.pmid = pmid;
  return record;
}

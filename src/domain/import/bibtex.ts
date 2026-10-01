import { plugins } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import type { CslItem, ImportWarning } from '../types';
import { cleanText, compactCsl } from './fields';
import { normalizeDoi, normalizePmid } from './normalize';
import type { ParsedRecord, ParseResult } from './types';

// The typings mark every option as required although citation-js fills in defaults.
const CHAIN_OPTIONS = {
  target: '@csl/list+object',
  generateGraph: false,
} as Parameters<typeof plugins.input.chain>[1];

const ENTRY_START = /^[ \t]*@([a-z]+)\s*[{(]/gim;

interface Chunk {
  kind: string;
  text: string;
  line: number;
}

/** Splits a file into entries at "@type{" at the start of a line, so one broken entry cannot hide the rest. */
function splitEntries(text: string): Chunk[] {
  const starts = [...text.matchAll(ENTRY_START)];
  return starts.map((match, index) => {
    const start = match.index;
    const end = starts[index + 1]?.index ?? text.length;
    return {
      kind: (match[1] ?? '').toLowerCase(),
      text: text.slice(start, end).trim(),
      line: text.slice(0, start).split('\n').length,
    };
  });
}

/** BibTeX via citation-js, entry by entry. @string macros apply to all entries. */
export function parseBibtex(text: string): ParseResult {
  const content = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const chunks = splitEntries(content);
  const macros = chunks
    .filter((chunk) => chunk.kind === 'string')
    .map((chunk) => chunk.text)
    .join('\n');
  const records: ParsedRecord[] = [];
  const warnings: ImportWarning[] = [];

  for (const chunk of chunks) {
    if (['string', 'comment', 'preamble'].includes(chunk.kind)) continue;
    let items: CslItem[];
    try {
      items = plugins.input.chain(`${macros}\n${chunk.text}`, CHAIN_OPTIONS) as CslItem[];
    } catch (error) {
      const detail = error instanceof Error ? (error.message.split('\n')[0] ?? '') : '';
      warnings.push({ code: 'bibtexError', line: chunk.line, detail });
      continue;
    }
    const item = items[0];
    if (!item) {
      warnings.push({ code: 'bibtexError', line: chunk.line });
      continue;
    }
    records.push(toRecord(item, chunk, warnings));
  }

  if (records.length === 0 && warnings.length === 0) warnings.push({ code: 'noRecords' });
  return { records, warnings };
}

function toRecord(item: CslItem, chunk: Chunk, warnings: ImportWarning[]): ParsedRecord {
  const { id: _id, 'citation-key': _key, _graph, ...rest } = item;
  void _id;
  void _key;
  void _graph;
  const doi = normalizeDoi(typeof rest.DOI === 'string' ? rest.DOI : undefined);
  const pmid = normalizePmid(typeof rest.PMID === 'string' ? rest.PMID : undefined);
  const title = cleanText(rest.title);
  if (!title) warnings.push({ code: 'missingTitle', line: chunk.line });
  const csl = compactCsl({
    ...rest,
    title,
    DOI: doi,
    PMID: pmid,
    abstract: cleanText(rest.abstract),
  });
  const record: ParsedRecord = { csl, raw: chunk.text, line: chunk.line };
  if (doi) record.doi = doi;
  if (pmid) record.pmid = pmid;
  return record;
}

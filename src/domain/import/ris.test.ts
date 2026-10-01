import { describe, expect, it } from 'vitest';
import { parseRis } from './ris';

const RECORD = [
  'TY  - JOUR',
  'TI  - Reporting literature searches',
  'AU  - Berger, Anna',
  'AU  - Novak, Petr',
  'PY  - 2022',
  'T2  - Journal of Evidence Synthesis Methods',
  'VL  - 14',
  'IS  - 3',
  'SP  - 201',
  'EP  - 214',
  'DO  - 10.5555/FR.TEST.0001',
  'AB  - First line.',
  'AB  - Second line.',
  'KW  - searching',
  'KW  - reporting',
  'ER  - ',
].join('\n');

describe('parseRis', () => {
  it('maps a journal article to CSL-JSON and keeps the raw entry and start line', () => {
    const { records, warnings } = parseRis(`\n${RECORD}\n`);
    expect(warnings).toEqual([]);
    expect(records).toHaveLength(1);
    const [record] = records;
    expect(record?.line).toBe(2);
    expect(record?.raw).toBe(RECORD);
    expect(record?.doi).toBe('10.5555/fr.test.0001');
    expect(record?.csl).toEqual({
      type: 'article-journal',
      title: 'Reporting literature searches',
      author: [
        { family: 'Berger', given: 'Anna' },
        { family: 'Novak', given: 'Petr' },
      ],
      issued: { 'date-parts': [[2022]] },
      'container-title': 'Journal of Evidence Synthesis Methods',
      volume: '14',
      issue: '3',
      page: '201-214',
      DOI: '10.5555/FR.TEST.0001',
      abstract: 'First line. Second line.',
      keyword: 'searching, reporting',
    });
  });

  it('accepts CRLF, a byte order mark and "ER  -" without trailing space', () => {
    const text = `\uFEFF${RECORD.replace('ER  - ', 'ER  -')}`.replace(/\n/g, '\r\n');
    const { records, warnings } = parseRis(text);
    expect(warnings).toEqual([]);
    expect(records[0]?.csl.title).toBe('Reporting literature searches');
    expect(records[0]?.raw).not.toContain('\r');
  });

  it('understands ProQuest variants (T1, JF, Y1 with slashes, author suffix)', () => {
    const text = [
      'TY  - JOUR',
      'T1  - Taking it a step farther',
      'JF  - Journal of the Medical Library Association',
      'AU  - Raszewski, Rebecca, AHIP',
      'Y1  - 2026/04//',
      'DO  - https://doi.org/10.5195/JMLA.2026.1',
      'ER  - ',
    ].join('\n');
    const csl = parseRis(text).records[0]?.csl;
    expect(csl?.title).toBe('Taking it a step farther');
    expect(csl?.['container-title']).toBe('Journal of the Medical Library Association');
    expect(csl?.issued).toEqual({ 'date-parts': [[2026, 4]] });
    expect(csl?.author).toEqual([{ family: 'Raszewski', given: 'Rebecca', suffix: 'AHIP' }]);
  });

  it('uses an abbreviated journal title only as fallback', () => {
    const text = ['TY  - JOUR', 'TI  - T', 'JO  - J Evid Synth Methods', 'ER  - '].join('\n');
    expect(parseRis(text).records[0]?.csl['container-title']).toBe('J Evid Synth Methods');
  });

  it('never stores an empty DOI (case C1) and decodes HTML entities (case G)', () => {
    const text = [
      'TY  - CHAP',
      'TI  - Grey literature &amp; documentation – a guide',
      "AU  - O'Brien, Siobhán",
      'PY  - ',
      'DO  - ',
      'PB  - Example Academic Press',
      'ER  - ',
    ].join('\n');
    const record = parseRis(text).records[0];
    expect(record?.doi).toBeUndefined();
    expect(record?.csl).not.toHaveProperty('DOI');
    expect(record?.csl).not.toHaveProperty('issued');
    expect(record?.csl.type).toBe('chapter');
    expect(record?.csl.title).toBe('Grey literature & documentation – a guide');
    expect(record?.csl.publisher).toBe('Example Academic Press');
  });

  it('reads the PMID from C2 only for Scopus exports', () => {
    const scopus = ['TY  - JOUR', 'TI  - T', 'C2  - 42640816', 'DB  - Scopus', 'ER  - '];
    expect(parseRis(scopus.join('\n')).records[0]?.pmid).toBe('42640816');
    const other = ['TY  - JOUR', 'TI  - T', 'C2  - PMC1234567', 'DB  - EndNote', 'ER  - '];
    expect(parseRis(other.join('\n')).records[0]?.pmid).toBeUndefined();
    const pubmed = ['TY  - JOUR', 'TI  - T', 'AN  - 33499930', 'DB  - PubMed', 'ER  - '];
    expect(parseRis(pubmed.join('\n')).records[0]?.pmid).toBe('33499930');
  });

  it('maps Scopus label types and warns about them with the line number', () => {
    const text = ['TY  - label.ris.referenceType.BOOK_CHAPTER', 'TI  - T', 'ER  - '].join('\n');
    const { records, warnings } = parseRis(text);
    expect(records[0]?.csl.type).toBe('chapter');
    expect(warnings).toEqual([
      { code: 'unknownType', line: 1, detail: 'label.ris.referenceType.BOOK_CHAPTER' },
    ]);
  });

  it('keeps a record that lacks ER and warns', () => {
    const text = ['TY  - JOUR', 'TI  - One', 'ER  - ', '', 'TY  - JOUR', 'TI  - Two'].join('\n');
    const { records, warnings } = parseRis(text);
    expect(records.map((r) => r.csl.title)).toEqual(['One', 'Two']);
    expect(warnings).toEqual([{ code: 'missingEnd', line: 5 }]);
  });

  it('closes a record that is followed by TY without ER', () => {
    const text = ['TY  - JOUR', 'TI  - One', 'TY  - JOUR', 'TI  - Two', 'ER  - '].join('\n');
    const { records, warnings } = parseRis(text);
    expect(records.map((r) => r.csl.title)).toEqual(['One', 'Two']);
    expect(warnings).toEqual([{ code: 'missingEnd', line: 1 }]);
  });

  it('reports text outside records and records without a title', () => {
    const text = ['garbage', 'TY  - JOUR', 'AU  - Doe, J', 'ER  - '].join('\n');
    const { records, warnings } = parseRis(text);
    expect(records).toHaveLength(1);
    expect(warnings).toEqual([
      { code: 'textOutsideRecord', line: 1 },
      { code: 'missingTitle', line: 2 },
    ]);
  });

  it('appends continuation lines to the previous field', () => {
    const text = ['TY  - JOUR', 'TI  - A very long', 'title on two lines', 'ER  - '].join('\n');
    expect(parseRis(text).records[0]?.csl.title).toBe('A very long title on two lines');
  });

  it('returns an explicit warning for empty input', () => {
    expect(parseRis('')).toEqual({ records: [], warnings: [{ code: 'noRecords' }] });
    expect(parseRis('just text')).toEqual({
      records: [],
      warnings: [{ code: 'textOutsideRecord', line: 1 }, { code: 'noRecords' }],
    });
  });
});

import { describe, expect, it } from 'vitest';
import { parseNbib } from './nbib';

const RECORD = [
  'PMID- 33499930',
  'OWN - NLM',
  'DP  - 2021 Jan 26',
  'TI  - PRISMA-S: an extension to the PRISMA Statement for Reporting Literature Searches ',
  '      in Systematic Reviews.',
  'PG  - 39',
  'LID - 10.1186/s13643-020-01542-z [doi]',
  'LID - 39',
  'AB  - First part',
  '      continues here.',
  'FAU - Rethlefsen, Melissa L',
  'AU  - Rethlefsen ML',
  'FAU - Kirtley, Shona',
  'AU  - Kirtley S',
  'LA  - eng',
  'PT  - Journal Article',
  'TA  - Syst Rev',
  'JT  - Systematic reviews',
  'VI  - 10',
  'IP  - 1',
].join('\r\n');

describe('parseNbib', () => {
  it('reads a MEDLINE record with continuation lines and full author names', () => {
    const { records, warnings } = parseNbib(RECORD);
    expect(warnings).toEqual([]);
    const [record] = records;
    expect(record?.line).toBe(1);
    expect(record?.pmid).toBe('33499930');
    expect(record?.doi).toBe('10.1186/s13643-020-01542-z');
    expect(record?.raw).toBe(RECORD.replace(/\r\n/g, '\n'));
    expect(record?.csl).toEqual({
      type: 'article-journal',
      title:
        'PRISMA-S: an extension to the PRISMA Statement for Reporting Literature Searches in Systematic Reviews.',
      author: [
        { family: 'Rethlefsen', given: 'Melissa L' },
        { family: 'Kirtley', given: 'Shona' },
      ],
      issued: { 'date-parts': [[2021, 1, 26]] },
      'container-title': 'Systematic reviews',
      'container-title-short': 'Syst Rev',
      volume: '10',
      issue: '1',
      page: '39',
      DOI: '10.1186/s13643-020-01542-z',
      PMID: '33499930',
      abstract: 'First part continues here.',
      language: 'eng',
    });
  });

  it('falls back to short author names and the abbreviated journal (case B)', () => {
    const text = [
      'PMID- 99000001',
      'TI  - Automation tools in title and abstract screening: a scoping review.',
      'AU  - Garcia-Lopez MJ',
      'AU  - van der Berg J',
      'DP  - 2025 Mar',
      'TA  - Syst Rev',
      'LID - 10.5555/fr.test.0011 [doi]',
    ].join('\n');
    const record = parseNbib(text).records[0];
    expect(record?.csl.author).toEqual([
      { family: 'Garcia-Lopez', given: 'MJ' },
      { family: 'van der Berg', given: 'J' },
    ]);
    expect(record?.csl['container-title']).toBe('Syst Rev');
    expect(record?.csl.issued).toEqual({ 'date-parts': [[2025, 3]] });
    expect(record?.doi).toBe('10.5555/fr.test.0011');
  });

  it('separates records at PMID lines and reports their start lines', () => {
    const text = ['PMID- 1', 'TI  - One', '', 'PMID- 2', 'TI  - Two', 'AID - 10.1/two [doi]'].join(
      '\n',
    );
    const { records } = parseNbib(text);
    expect(records.map((r) => [r.line, r.pmid, r.doi])).toEqual([
      [1, '1', undefined],
      [4, '2', '10.1/two'],
    ]);
  });

  it('removes the brackets of translated titles', () => {
    const text = ['PMID- 1', 'TI  - [Systematic searches in German libraries].'].join('\n');
    expect(parseNbib(text).records[0]?.csl.title).toBe('Systematic searches in German libraries.');
  });

  it('warns about text before the first record and missing titles', () => {
    const { records, warnings } = parseNbib(['Some header', 'PMID- 5', 'AU  - Doe J'].join('\n'));
    expect(records).toHaveLength(1);
    expect(warnings).toEqual([
      { code: 'textOutsideRecord', line: 1 },
      { code: 'missingTitle', line: 2 },
    ]);
    expect(parseNbib('')).toEqual({ records: [], warnings: [{ code: 'noRecords' }] });
  });
});

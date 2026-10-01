import { describe, expect, it } from 'vitest';
import { parseRis } from '../import/ris';
import type { CslItem } from '../types';
import { toRis, toRisRecord } from './ris';

const article: CslItem = {
  type: 'article-journal',
  title: 'Peer tutoring & grades – a review',
  author: [
    { family: 'Müller', given: 'Jürgen' },
    { family: 'Ng', given: 'A.', suffix: 'Jr.' },
  ],
  editor: [{ literal: 'Cochrane Austria' }, { family: 'WHO' }],
  issued: { 'date-parts': [[2023, 5, 7]] },
  'container-title': 'Journal of Evidence Synthesis',
  'container-title-short': 'J Evid Synth',
  volume: '12',
  issue: '3',
  page: '201-214',
  DOI: '10.5555/fr.test.0001',
  ISSN: '1234-5678',
  URL: 'https://example.org/a',
  abstract: 'First line.\nSecond line.',
  keyword: 'tutoring, grades',
  language: 'en',
  publisher: 'Example Press',
};

describe('toRisRecord', () => {
  it('writes the tags read by the RIS parser, one value per line', () => {
    const ris = toRisRecord({ csl: article, doi: '10.5555/fr.test.0001', pmid: '123' });
    expect(ris.split('\r\n')).toEqual([
      'TY  - JOUR',
      'TI  - Peer tutoring & grades – a review',
      'AU  - Müller, Jürgen',
      'AU  - Ng, A., Jr.',
      'A2  - Cochrane Austria',
      'A2  - WHO,',
      'PY  - 2023',
      'DA  - 2023/05/07/',
      'T2  - Journal of Evidence Synthesis',
      'J2  - J Evid Synth',
      'VL  - 12',
      'IS  - 3',
      'SP  - 201',
      'EP  - 214',
      'DO  - 10.5555/fr.test.0001',
      'SN  - 1234-5678',
      'UR  - https://example.org/a',
      'AB  - First line. Second line.',
      'KW  - tutoring',
      'KW  - grades',
      'LA  - en',
      'PB  - Example Press',
      'N1  - PMID: 123',
      'ER  - ',
      '',
    ]);
  });

  it('maps CSL types back to RIS types and adds notes', () => {
    const chapter = toRisRecord({ csl: { type: 'chapter', title: 'C' }, notes: ['Study: S1'] });
    expect(chapter).toContain('TY  - CHAP');
    expect(chapter).toContain('N1  - Study: S1');
    expect(toRisRecord({ csl: { type: 'article', title: 'X' } })).toContain('TY  - GEN');
    expect(toRisRecord({ csl: { type: 'something-else' } })).toContain('TY  - GEN');
  });

  it('writes a single page and a year without month', () => {
    const ris = toRisRecord({
      csl: { type: 'article-journal', page: 'e123', issued: { 'date-parts': [[2021]] } },
    });
    expect(ris).toContain('SP  - e123');
    expect(ris).not.toContain('EP  -');
    expect(ris).not.toContain('DA  -');
  });
});

describe('RIS roundtrip', () => {
  it('reads back what it writes', () => {
    const [parsed] = parseRis(toRis([{ csl: article, doi: '10.5555/fr.test.0001' }])).records;
    expect(parsed?.doi).toBe('10.5555/fr.test.0001');
    expect(parsed?.csl).toMatchObject({
      type: 'article-journal',
      title: article.title,
      author: article.author,
      editor: article.editor,
      issued: article.issued,
      'container-title': article['container-title'],
      'container-title-short': article['container-title-short'],
      volume: '12',
      issue: '3',
      page: '201-214',
      ISSN: '1234-5678',
      abstract: 'First line. Second line.',
      keyword: 'tutoring, grades',
      language: 'en',
      publisher: 'Example Press',
    });
  });
});

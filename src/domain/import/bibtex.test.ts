import { describe, expect, it } from 'vitest';
import { parseBibtex } from './bibtex';

describe('parseBibtex', () => {
  it('converts an entry to CSL and normalises identifiers', () => {
    const text = [
      '@article{weber2024,',
      '  title = {Documenting {PRISMA-S} searches in {\\"O}sterreich},',
      "  author = {Weber, Katrin and L{\\'o}pes, Rui},",
      '  journal = {J Med Libr Assoc},',
      '  year = {2024},',
      '  doi = {https://doi.org/10.5555/FR.TEST.0020},',
      '  pmid = {99000020}',
      '}',
    ].join('\n');
    const { records, warnings } = parseBibtex(text);
    expect(warnings).toEqual([]);
    expect(records[0]).toMatchObject({
      line: 1,
      doi: '10.5555/fr.test.0020',
      pmid: '99000020',
      csl: {
        type: 'article-journal',
        title: 'Documenting PRISMA-S searches in Österreich',
        author: [
          { family: 'Weber', given: 'Katrin' },
          { family: 'Lópes', given: 'Rui' },
        ],
        issued: { 'date-parts': [[2024]] },
        'container-title': 'J Med Libr Assoc',
      },
    });
    expect(records[0]?.raw).toBe(text);
    expect(records[0]?.csl).not.toHaveProperty('id');
    expect(records[0]?.csl).not.toHaveProperty('citation-key');
  });

  it('keeps the other entries when one is broken and reports its line', () => {
    const text = [
      '@article{a, title = {First}, year = {2020}}',
      '',
      '@article{broken,',
      '  title = {Never closed,',
      '',
      '@book{c, title = {Third}, year = {2019}}',
    ].join('\n');
    const { records, warnings } = parseBibtex(text);
    expect(records.map((r) => [r.line, r.csl.title])).toEqual([
      [1, 'First'],
      [6, 'Third'],
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'bibtexError', line: 3 });
  });

  it('applies @string macros and ignores comments and preambles', () => {
    const text = [
      '% comment',
      '@string{jmla = "Journal of the Medical Library Association"}',
      '@preamble{"\\newcommand{\\noop}[1]{}"}',
      '@article{a, title = {T}, journal = jmla}',
    ].join('\n');
    const { records, warnings } = parseBibtex(text);
    expect(warnings).toEqual([]);
    expect(records.map((r) => r.csl['container-title'])).toEqual([
      'Journal of the Medical Library Association',
    ]);
  });

  it('warns about missing titles and empty input', () => {
    expect(parseBibtex('@misc{x, year = {2020}}').warnings).toEqual([
      { code: 'missingTitle', line: 1 },
    ]);
    expect(parseBibtex('')).toEqual({ records: [], warnings: [{ code: 'noRecords' }] });
  });
});

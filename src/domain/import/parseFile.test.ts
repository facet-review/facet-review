import { describe, expect, it } from 'vitest';
import { detectFormat, parseFile } from './parseFile';

describe('detectFormat', () => {
  it('recognises formats by content first', () => {
    expect(detectFormat('export.txt', 'TY  - JOUR\nER  - ')).toBe('ris');
    expect(detectFormat('pubmed.txt', '\r\nPMID- 123\r\nTI  - x')).toBe('nbib');
    expect(detectFormat('refs.txt', '% c\n@article{a, title={x}}')).toBe('bibtex');
  });

  it('falls back to the file extension', () => {
    expect(detectFormat('scopus.csv', 'Authors,Title')).toBe('csv');
    expect(detectFormat('data.tsv', 'Title\tYear')).toBe('csv');
    expect(detectFormat('x.RIS', '')).toBe('ris');
    expect(detectFormat('notes.docx', 'binary')).toBeUndefined();
  });
});

describe('parseFile', () => {
  it('dispatches to the right parser', () => {
    expect(parseFile('TY  - JOUR\nTI  - A\nER  - ', 'ris').records).toHaveLength(1);
    expect(parseFile('PMID- 1\nTI  - A', 'nbib').records).toHaveLength(1);
    expect(parseFile('@article{a, title={A}}', 'bibtex').records).toHaveLength(1);
  });

  it('detects the CSV mapping unless one is given', () => {
    const text = 'Titel,Jahr\nA,2020\n';
    expect(parseFile(text, 'csv').warnings).toEqual([{ code: 'csvNoTitleColumn' }]);
    const mapped = parseFile(text, 'csv', { title: 0, year: 1 });
    expect(mapped.records[0]?.csl.title).toBe('A');
    expect(mapped.csv?.headers).toEqual(['Titel', 'Jahr']);
    expect(mapped.csv?.mapping).toEqual({ title: 0, year: 1 });
  });
});

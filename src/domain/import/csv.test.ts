import { describe, expect, it } from 'vitest';
import { csvToRecords, detectCsvMapping, readCsv } from './csv';

const SYNTHETIC = [
  'Title,Authors,Year,Source,DOI,PMID,Abstract',
  '"Documenting database searches with PRISMA-S: a cross-sectional study","Weber, K.; Lopes, R.",2024,"Journal of the Medical Library Association",,99000002,"Abstract K2."',
  '"Semicolons; commas, and ""quotes"" in a CSV title","Doe, J.",2020,"Test Journal",10.5555/FR.TEST.0013,,"Abstract L1."',
].join('\n');

describe('readCsv', () => {
  it('reads header and rows with their start lines, handling quotes and BOM', () => {
    const table = readCsv(`\uFEFF${SYNTHETIC}`);
    expect(table.headers).toEqual([
      'Title',
      'Authors',
      'Year',
      'Source',
      'DOI',
      'PMID',
      'Abstract',
    ]);
    expect(table.rows.map((row) => row.line)).toEqual([2, 3]);
    expect(table.rows[1]?.cells[0]).toBe('Semicolons; commas, and "quotes" in a CSV title');
    expect(table.warnings).toEqual([]);
  });

  it('counts lines inside multi-line cells and detects semicolon separators', () => {
    const table = readCsv('Title;Year\r\n"Line one\r\nline two";2020\r\nNext;2021\r\n');
    expect(table.rows.map((row) => [row.line, row.cells[0]])).toEqual([
      [2, 'Line one\r\nline two'],
      [4, 'Next'],
    ]);
  });

  it('warns about rows with a different number of columns', () => {
    const table = readCsv('Title,Year\nA,2020\nB\n');
    expect(table.warnings).toEqual([{ code: 'csvColumnCount', line: 3 }]);
  });
});

describe('detectCsvMapping', () => {
  it('recognises generic column names', () => {
    expect(
      detectCsvMapping(['Title', 'Authors', 'Year', 'Source', 'DOI', 'PMID', 'Abstract']),
    ).toEqual({
      title: 0,
      authors: 1,
      year: 2,
      container: 3,
      doi: 4,
      pmid: 5,
      abstract: 6,
    });
  });

  it('prefers full author names and finds the Scopus columns', () => {
    const headers = [
      'Authors',
      'Author full names',
      'Author(s) ID',
      'Title',
      'Year',
      'Source title',
      'Volume',
      'Issue',
      'Art. No.',
      'Page start',
      'Page end',
      'DOI',
      'Abstract',
      'Author Keywords',
      'PubMed ID',
      'Language of Original Document',
      'Document Type',
    ];
    expect(detectCsvMapping(headers)).toEqual({
      authors: 1,
      title: 3,
      year: 4,
      container: 5,
      volume: 6,
      issue: 7,
      pageStart: 9,
      pageEnd: 10,
      doi: 11,
      abstract: 12,
      keywords: 13,
      pmid: 14,
      language: 15,
      type: 16,
    });
  });
});

describe('csvToRecords', () => {
  it('maps rows to CSL records (cases K2 and L)', () => {
    const table = readCsv(SYNTHETIC);
    const { records, warnings } = csvToRecords(table, detectCsvMapping(table.headers));
    expect(warnings).toEqual([]);
    expect(records[0]).toMatchObject({
      line: 2,
      pmid: '99000002',
      csl: {
        type: 'article-journal',
        title: 'Documenting database searches with PRISMA-S: a cross-sectional study',
        author: [
          { family: 'Weber', given: 'K.' },
          { family: 'Lopes', given: 'R.' },
        ],
        issued: { 'date-parts': [[2024]] },
        'container-title': 'Journal of the Medical Library Association',
        PMID: '99000002',
      },
    });
    expect(records[0]).not.toHaveProperty('doi');
    expect(records[1]?.csl.title).toBe('Semicolons; commas, and "quotes" in a CSV title');
    expect(records[1]?.doi).toBe('10.5555/fr.test.0013');
    expect(records[1]?.raw).toContain('"Semicolons; commas, and ""quotes"" in a CSV title"');
  });

  it('strips Scopus author ids, joins pages and maps document types', () => {
    const table = readCsv(
      [
        'Author full names,Title,Page start,Page end,Document Type',
        '"Rethlefsen, Melissa L. (6603373012); Kirtley, Shona (57193746353)",T,10,20,Book chapter',
      ].join('\n'),
    );
    const csl = csvToRecords(table, detectCsvMapping(table.headers)).records[0]?.csl;
    expect(csl?.author).toEqual([
      { family: 'Rethlefsen', given: 'Melissa L.' },
      { family: 'Kirtley', given: 'Shona' },
    ]);
    expect(csl?.page).toBe('10-20');
    expect(csl?.type).toBe('chapter');
  });

  it('warns about rows without a title and needs a title column', () => {
    const table = readCsv('Title,Year\n,2020\nA,2021\n');
    expect(csvToRecords(table, { title: 0, year: 1 }).warnings).toEqual([
      { code: 'missingTitle', line: 2 },
    ]);
    expect(csvToRecords(table, { year: 1 })).toEqual({
      records: [],
      warnings: [{ code: 'csvNoTitleColumn' }],
    });
  });
});

import { describe, expect, it } from 'vitest';
import { defaultDelimiter, toCsv } from './csv';

describe('toCsv', () => {
  it('starts with a UTF-8 BOM, quotes every cell and ends lines with CRLF', () => {
    expect(
      toCsv(
        [
          ['a', 'b'],
          ['1', '2'],
        ],
        ';',
      ),
    ).toBe('\uFEFF"a";"b"\r\n"1";"2"\r\n');
  });

  it('uses the chosen delimiter and escapes quotes', () => {
    expect(toCsv([['Wrong "design"', 'x;y,z']], ',')).toBe('\uFEFF"Wrong ""design""","x;y,z"\r\n');
    expect(toCsv([['a', 'b']], '\t')).toBe('\uFEFF"a"\t"b"\r\n');
  });

  it('keeps line breaks inside cells and writes empty rows', () => {
    expect(toCsv([['line 1\nline 2'], []], ';')).toBe('\uFEFF"line 1\nline 2"\r\n\r\n');
  });

  it('neutralises spreadsheet formulas (CSV injection)', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '@SUM(A1)', '-3', 'a=b']], ',')).toBe(
      '\uFEFF"\'=HYPERLINK(""x"")","\'+1","\'@SUM(A1)","-3","a=b"\r\n',
    );
  });
});

describe('defaultDelimiter', () => {
  it('uses semicolons for German (Excel default there) and commas otherwise', () => {
    expect(defaultDelimiter('de')).toBe(';');
    expect(defaultDelimiter('de-AT')).toBe(';');
    expect(defaultDelimiter('en')).toBe(',');
  });
});

describe('export labels', () => {
  it('has unique keys', async () => {
    const { EXPORT_LABEL_KEYS } = await import('./labels');
    expect(new Set(EXPORT_LABEL_KEYS).size).toBe(EXPORT_LABEL_KEYS.length);
  });
});

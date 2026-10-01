import { describe, expect, it } from 'vitest';
import { includedRis, includedRows, recordRows } from '../../src/domain/export/data';
import type { ExportLabelKey } from '../../src/domain/export/labels';
import { parseRis } from '../../src/domain/import/ris';
import { playGoldenScenario } from './golden';

const t = (key: ExportLabelKey) => `<${key}>`;

describe('included studies (golden scenario)', () => {
  const session = playGoldenScenario();
  const rows = includedRows(session.bundle(), t);
  const [header, ...body] = rows;

  it('lists one row per included report with its study, ending with the attribution', () => {
    expect(header?.slice(0, 3)).toEqual(['<study>', '<title>', '<authors>']);
    const reports = body.filter((row) => row.length > 1);
    expect(reports).toHaveLength(3);
    expect(reports.map((row) => row[0]).sort()).toEqual(['Studie 1', 'Studie 1', 'Studie 2']);
    expect(rows.slice(-2)).toEqual([['<source2020>'], ['<license>']]);
  });

  it('names the sources each report was found in', () => {
    const sourcesColumn = header!.indexOf('<sources>');
    const b = body.find(
      (row) => row[1]?.includes('Documenting') || row[sourcesColumn]?.includes('PubMed'),
    );
    expect(b?.[sourcesColumn]).toContain('Synthetic PubMed');
  });

  it('exports the same reports as RIS with study notes, readable again', () => {
    const ris = includedRis(session.bundle(), t);
    const parsed = parseRis(ris).records;
    expect(parsed).toHaveLength(3);
    expect(ris).toContain('N1  - <study>: Studie 1');
    expect(ris).not.toContain('Page MJ');
  });
});

describe('all records with status and decisions (golden scenario)', () => {
  const session = playGoldenScenario();
  const rows = recordRows(session.bundle(), t);
  const [header, ...body] = rows;
  const col = (key: ExportLabelKey) => header!.indexOf(`<${key}>`);
  const row = (id: string) => body.find((r) => r[col('recordId')] === id)!;

  it('has one row per imported record', () => {
    expect(body.filter((r) => r.length > 1)).toHaveLength(16);
  });

  it('marks duplicates and the unit they belong to', () => {
    const a1 = row('A1');
    const a2 = row('A2');
    expect(a1[col('unit')]).toBe(a2[col('unit')]);
    expect([a1[col('role')], a2[col('role')]].sort()).toEqual(
      ['<duplicateOf> ' + a1[col('unit')], '<primary>'].sort(),
    );
  });

  it('shows both stages with reasons and studies', () => {
    expect(row('A1')[col('titleAbstract')]).toBe('<include>');
    expect(row('A1')[col('fullText')]).toBe('<exclude>');
    expect(row('A1')[col('fullTextReason')]).toBe('Falsches Studiendesign');
    expect(row('K2')[col('study')]).toBe('Studie 1');
    expect(row('F1')[col('fullText')]).toBe('<notInStage>');
  });

  it('keeps the full decision history, e.g. H1: include → undo → exclude', () => {
    const history = row('H1')[col('history')]!;
    expect(history.split(' | ').map((entry) => entry.split(' ').slice(1).join(' '))).toEqual([
      '<title_abstract> <include>',
      '<title_abstract> <reset>',
      '<title_abstract> <exclude>',
    ]);
  });

  it('flags units to review after a split (golden §6 case 2)', () => {
    const split = recordRows(playGoldenScenario({ splitC: true }).bundle(), t);
    const c2 = split.find((r) => r[col('recordId')] === 'C2')!;
    expect(c2[col('titleAbstract')]).toBe('<review>');
  });

  it('ends with the attribution', () => {
    expect(rows.slice(-2)).toEqual([['<source2020>'], ['<license>']]);
  });
});

describe('record rows: removed, open and conflicting units', () => {
  it('writes removal, open and conflict states and falls back for missing data', () => {
    const session = playGoldenScenario();
    session.decide('F1', { stage: 'pre_screening', value: 'remove_other', note: 'retracted' });
    session.decide('C2', { stage: 'full_text', value: 'not_retrieved' });
    const rows = recordRows(session.bundle(), t);
    const header = rows[0]!;
    const col = (key: ExportLabelKey) => header.indexOf(`<${key}>`);
    const row = (id: string) => rows.find((r) => r[col('recordId')] === id)!;
    expect(row('F1')[col('removed')]).toBe('<remove_other>');
    expect(row('F1')[col('removedNote')]).toBe('retracted');
    expect(row('F1')[col('titleAbstract')]).toBe('<notInStage>');
    // C1 and C2 form one unit: the later "not retrieved" replaces the earlier exclusion.
    expect(row('C1')[col('fullText')]).toBe('<not_retrieved>');
    expect(row('G1')[col('fullText')]).toBe('<notInStage>');
  });

  it('marks open units and uses the study id when a study has no label', () => {
    const session = playGoldenScenario({ skipD2FullText: true });
    session.decide('D2', { stage: 'full_text', value: 'include', studyId: 'unknown-study' });
    const included = includedRows(session.bundle(), t);
    expect(included.some((r) => r[0] === 'unknown-study')).toBe(true);

    const open = playGoldenScenario({ skipD2FullText: true });
    const rows = recordRows(open.bundle(), t);
    const header = rows[0]!;
    const d2 = rows.find((r) => r[header.indexOf('<recordId>')] === 'D2')!;
    expect(d2[header.indexOf('<fullText>')]).toBe('<open>');
  });

  it('marks conflicts after merging differently decided records', () => {
    const session = playGoldenScenario();
    session.decide('D1', { stage: 'title_abstract', value: 'exclude' });
    session.dedupDecision('merge', 'D1', 'D2');
    const rows = recordRows(session.bundle(), t);
    const header = rows[0]!;
    const d2 = rows.find((r) => r[header.indexOf('<recordId>')] === 'D2')!;
    expect(d2[header.indexOf('<titleAbstract>')]).toBe('<conflict>');
    expect(d2[header.indexOf('<flags>')]).toBe('');
  });
});

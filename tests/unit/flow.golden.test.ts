import { describe, expect, it } from 'vitest';
import { computeFlow } from '../../src/domain/flow/computeFlow';
import { drawnReasons } from '../../src/domain/flow/computeFlow';
import { playGoldenScenario } from './golden';

/**
 * tests/fixtures/flow/golden-scenario.md – the binding acceptance of
 * milestone 5. Sections are referenced as §n.
 */
describe('golden scenario (tests/fixtures/flow/golden-scenario.md)', () => {
  const session = playGoldenScenario();
  const flow = computeFlow(session.bundle());
  const db = flow.databases;

  it('§2: 4 duplicates removed, 12 unique screening units', () => {
    expect(session.evaluated).toHaveLength(12);
  });

  it('§3: H1 counts its last decision only; the audit trail keeps both', () => {
    const h1 = session.unitOf('H1');
    expect(h1.titleAbstract.decision?.value).toBe('exclude');
    expect(h1.history.map((d) => d.value)).toEqual(['exclude', 'reset', 'include']);
  });

  it('§5: uses the variant "new review, databases and registers only"', () => {
    expect(flow.variant).toBe('new_db');
  });

  it('§5: records identified from databases – 16, per database 12 / 2 / 2', () => {
    expect(db.identified.n).toBe(16);
    expect(db.databases.map((s) => [s.label, s.n])).toEqual([
      ['Synthetic Scopus', 12],
      ['Synthetic PubMed', 2],
      ['Synthetic CSV-DB', 2],
    ]);
  });

  it('§5: records identified from registers – 0', () => {
    expect(db.registers).toEqual([]);
  });

  it('§5: records removed before screening – duplicates 4, automation 0, other 0', () => {
    expect(db.duplicates.n).toBe(4);
    expect(db.removedAutomation.n).toBe(0);
    expect(db.removedOther.n).toBe(0);
  });

  it('§5: records screened 12, excluded 5', () => {
    expect(db.screened.n).toBe(12);
    expect(db.excluded.n).toBe(5);
  });

  it('§5: reports sought 7, not retrieved 1, assessed 6', () => {
    expect(db.sought.n).toBe(7);
    expect(db.notRetrieved.n).toBe(1);
    expect(db.assessed.n).toBe(6);
  });

  it('§5: reports excluded 3 – study design 2, language 1, population 0 not drawn', () => {
    expect(db.reportsExcludedTotal.n).toBe(3);
    expect(db.reportsExcluded.map((r) => [r.label, r.n])).toEqual([
      ['Falsche Population', 0],
      ['Falsches Studiendesign', 2],
      ['Falsche Sprache', 1],
    ]);
    expect(drawnReasons(db.reportsExcluded).map((r) => r.label)).toEqual([
      'Falsches Studiendesign',
      'Falsche Sprache',
    ]);
  });

  it('§5: studies included 2, reports of included studies 3', () => {
    expect(flow.studies.n).toBe(2);
    expect(flow.reports.n).toBe(3);
    expect(flow.studies.groups.map((g) => [g.label, g.n]).sort()).toEqual([
      ['Studie 1', 2],
      ['Studie 2', 1],
    ]);
  });

  it('§5: all consistency checks pass without warning', () => {
    expect(flow.checks.map((c) => [c.id, c.total, c.parts, c.open, c.status])).toEqual([
      ['identification', 16, [4, 0, 0, 12], 0, 'ok'],
      ['screening', 12, [5, 7], 0, 'ok'],
      ['retrieval', 7, [1, 6], 0, 'ok'],
      ['eligibility', 6, [3, 3], 0, 'ok'],
    ]);
  });

  it('every number leads back to records (drill-down)', () => {
    expect(db.excluded.recordIds.sort()).toEqual(['F1', 'F2', 'G1', 'H1', 'L1']);
    expect(db.notRetrieved.recordIds).toEqual(['E1']);
    // Units are listed by their primary record (the most complete one, milestone 3).
    const unitsOf = (ids: string[]) => ids.map((id) => session.unitOf(id).unit.key).sort();
    expect(unitsOf(flow.reports.recordIds)).toEqual(unitsOf(['B-ris', 'D2', 'K1']));
    expect(db.duplicates.recordIds).toHaveLength(4);
    expect(db.identified.recordIds).toHaveLength(16);
  });
});

describe('golden scenario §6: negative cases', () => {
  it('without the full-text decision for D2: "screening incomplete", 6 ≠ 3 + 2 (+1 open)', () => {
    const flow = computeFlow(playGoldenScenario({ skipD2FullText: true }).bundle());
    const eligibility = flow.checks.find((c) => c.id === 'eligibility')!;
    expect(eligibility).toMatchObject({ total: 6, parts: [3, 2], open: 1, status: 'incomplete' });
    expect(flow.databases.open.recordIds).toEqual(['D2']);
    expect(flow.reports.n).toBe(2);
  });

  // Decision of 01.10.2026 (milestone 4, rule 3): the split-off part is open
  // with the earlier decision as suggestion ("nach Aufteilung prüfen").
  it('undoing the C merge: duplicates 3, screened 13, C2 to be reviewed after the split', () => {
    const session = playGoldenScenario({ splitC: true });
    const flow = computeFlow(session.bundle());
    expect(flow.databases.duplicates.n).toBe(3);
    expect(flow.databases.screened.n).toBe(13);

    const c2 = session.unitOf('C2').titleAbstract;
    expect(c2.state).toBe('open');
    expect(c2.suggestion?.value).toBe('include');
    expect(flow.databases.sought.n).toBe(7);
    expect(flow.databases.openScreening.recordIds).toEqual(['C2']);
    const screening = flow.checks.find((c) => c.id === 'screening')!;
    expect(screening).toMatchObject({ total: 13, parts: [5, 7], open: 1, status: 'incomplete' });
  });
});

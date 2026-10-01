import { describe, expect, it } from 'vitest';
import { computeFlow } from '../../src/domain/flow/computeFlow';
import { detectVariant, hasOtherMethods, isUpdateVariant } from '../../src/domain/flow/variant';
import { Session } from './session';

const TA = 'title_abstract' as const;
const FT = 'full_text' as const;

/** Synthetic files in one database: 16 records, 13 units (C and D still candidates). */
function synthetic() {
  const session = new Session(['Wrong population']);
  const run = session.addSource('Synthetic DB');
  session.importFile('synthetic/edge-cases.ris', 'ris', run);
  session.importFile('synthetic/edge-cases.nbib', 'nbib', run);
  session.importFile('synthetic/edge-cases.csv', 'csv', run);
  return session;
}

const statusOf = (flow: ReturnType<typeof computeFlow>, id: string) =>
  flow.checks.find((c) => c.id === id && c.column === 'databases')!.status;

describe('computeFlow: left column', () => {
  it('counts nothing screened before any decision and reports the stage as incomplete', () => {
    const flow = computeFlow(synthetic().bundle());
    expect(flow.databases.identified.n).toBe(16);
    expect(flow.databases.duplicates.n).toBe(3);
    expect(flow.databases.screened.n).toBe(13);
    expect(flow.databases.openScreening.n).toBe(13);
    expect(statusOf(flow, 'identification')).toBe('ok');
    expect(statusOf(flow, 'screening')).toBe('incomplete');
  });

  it('counts removals before screening by automation and for other reasons', () => {
    const session = synthetic();
    session.decide('F1', { stage: 'pre_screening', value: 'remove_automation', note: 'ASReview' });
    session.decide('G1', { stage: 'pre_screening', value: 'remove_other', note: 'retracted' });
    const flow = computeFlow(session.bundle());
    expect(flow.databases.removedAutomation.recordIds).toEqual(['F1']);
    expect(flow.databases.removedOther.recordIds).toEqual(['G1']);
    expect(flow.databases.screened.n).toBe(11);
    expect(statusOf(flow, 'identification')).toBe('ok');
  });

  it('keeps maybes out of "sought" unless they are taken to full-text screening', () => {
    const session = synthetic();
    session.decide('A1', { stage: TA, value: 'maybe' });
    const maybeUnit = session.unitOf('A1').unit.primaryId;
    let flow = computeFlow(session.bundle());
    expect(flow.databases.sought.n).toBe(0);
    expect(flow.databases.openScreening.recordIds).toContain(maybeUnit);

    session.project = {
      ...session.project,
      screening: { ...session.project.screening, maybeToFullText: true },
    };
    flow = computeFlow(session.bundle());
    expect(flow.databases.sought.recordIds).toEqual([maybeUnit]);
  });

  it('counts conflicts after a merge as open', () => {
    const session = synthetic();
    session.decide('C1', { stage: TA, value: 'include' });
    session.decide('C2', { stage: TA, value: 'exclude' });
    session.dedupDecision('merge', 'C1', 'C2');
    const flow = computeFlow(session.bundle());
    expect(flow.databases.excluded.n).toBe(0);
    expect(flow.databases.sought.n).toBe(0);
    expect(flow.databases.openScreening.n).toBe(12);
  });

  it('lists search engines with the databases and registers separately', () => {
    const session = new Session();
    session.importFile(
      'synthetic/edge-cases.nbib',
      'nbib',
      session.addSource('Scholar', 'search_engine'),
    );
    session.importFile('synthetic/edge-cases.csv', 'csv', session.addSource('Trials', 'register'));
    session.addSource('Searched, nothing imported');
    const flow = computeFlow(session.bundle());
    expect(flow.databases.databases.map((s) => [s.label, s.n])).toEqual([
      ['Scholar', 2],
      ['Searched, nothing imported', 0],
    ]);
    expect(flow.databases.registers.map((s) => [s.label, s.n])).toEqual([['Trials', 2]]);
  });
});

describe('computeFlow: other methods (right column)', () => {
  function withCitationSearch() {
    const session = synthetic();
    session.decide('A1', { stage: TA, value: 'include' });
    const run = session.addSource('Backward citation searching', 'citation_search');
    session.importFile('synthetic/late-import.ris', 'ris', run);
    return session;
  }

  it('switches to the variant with other methods and counts records per method', () => {
    const flow = computeFlow(withCitationSearch().bundle());
    expect(flow.variant).toBe('new_db_other');
    expect(flow.other.identified.n).toBe(2);
    expect(flow.other.methods.map((m) => [m.method, m.n])).toEqual([['citations', 2]]);
  });

  it('reports a duplicate of a database record in the left unit, not as sought on the right', () => {
    const flow = computeFlow(withCitationSearch().bundle());
    expect(flow.other.inDatabaseUnits.recordIds).toEqual(['A3']);
    expect(flow.other.sought.recordIds).toEqual(['N1']);
    // A3 is no duplicate of the left column: identified there stays 16.
    expect(flow.databases.identified.n).toBe(16);
    expect(flow.databases.duplicates.n).toBe(3);
    expect(statusOf(flow, 'identification')).toBe('ok');
  });

  it('screens units of other methods in full text only', () => {
    const session = withCitationSearch();
    session.decide('N1', { stage: FT, value: 'include' });
    const flow = computeFlow(session.bundle());
    expect(flow.other.included.recordIds).toEqual(['N1']);
    expect(flow.reports.recordIds).toEqual(['N1']);
    expect(flow.checks.filter((c) => c.column === 'other').map((c) => c.status)).toEqual([
      'ok',
      'ok',
    ]);
  });

  it('counts duplicates found by other methods alone separately', () => {
    const session = new Session();
    session.importFile('synthetic/edge-cases.ris', 'ris', session.addSource('Web', 'website'));
    session.importFile('synthetic/late-import.ris', 'ris', session.addSource('Experts', 'contact'));
    const flow = computeFlow(session.bundle());
    // A1, A2 (website) and A3 (contact) share a DOI: one unit, two duplicates.
    expect(flow.other.duplicatesWithin.n).toBe(2);
    expect(flow.other.methods.map((m) => [m.method, m.n])).toEqual([
      ['websites', 12],
      ['organisations', 2],
    ]);
    expect(flow.other.sought.n).toBe(12); // 11 units from the website file + N1
  });
});

describe('computeFlow: update reviews', () => {
  it('carries the manually entered previous studies and reports', () => {
    const session = synthetic();
    session.project = {
      ...session.project,
      reviewType: 'update',
      flowOverrides: { previousStudies: 4, previousReports: 6 },
    };
    const flow = computeFlow(session.bundle());
    expect(flow.variant).toBe('update_db');
    expect(flow.previous).toEqual({ studies: 4, reports: 6 });
  });

  it('follows a manual variant override and keeps the detected one', () => {
    const session = synthetic();
    session.project = { ...session.project, flowOverrides: { variant: 'update_db_other' } };
    const flow = computeFlow(session.bundle());
    expect(flow.variant).toBe('update_db_other');
    expect(flow.detectedVariant).toBe('new_db');
    expect(flow.previous).toEqual({});
    expect(flow.checks.map((c) => c.column)).toContain('other');
  });

  it('has no previous numbers for new reviews', () => {
    expect(computeFlow(synthetic().bundle()).previous).toBeUndefined();
  });
});

describe('detectVariant', () => {
  const run = (sourceId: string) => ({ sourceId });
  it('combines review type and other methods with a search run', () => {
    const db = { id: 'd', type: 'database' as const };
    const web = { id: 'w', type: 'website' as const };
    expect(detectVariant({ reviewType: 'new' }, [db, web], [run('d')])).toBe('new_db');
    expect(detectVariant({ reviewType: 'new' }, [db, web], [run('w')])).toBe('new_db_other');
    expect(detectVariant({ reviewType: 'update' }, [db], [run('d')])).toBe('update_db');
    expect(detectVariant({ reviewType: 'update' }, [web], [run('w')])).toBe('update_db_other');
  });

  it('answers what a variant contains', () => {
    expect(isUpdateVariant('update_db')).toBe(true);
    expect(isUpdateVariant('new_db_other')).toBe(false);
    expect(hasOtherMethods('new_db_other')).toBe(true);
    expect(hasOtherMethods('update_db')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { deduplicate } from '../../src/domain/dedup/dedup';
import { assignGroupIds } from '../../src/domain/dedup/groupIds';
import { createDecision, type DecisionInput } from '../../src/domain/screening/decide';
import { evaluateUnits, stageItems, stageProgress } from '../../src/domain/screening/stages';
import { orderRecords, screeningUnits } from '../../src/domain/screening/units';
import type {
  BibRecord,
  Decision,
  DedupDecision,
  DuplicateGroup,
  ImportBatch,
  ImportFormat,
  ScreeningSettings,
} from '../../src/domain/types';
import { labelOf, parseFixture } from './fixtures';

const settings: ScreeningSettings = {
  maybeToFullText: false,
  highlights: { include: [], exclude: [] },
};
const columns = new Map([['run', 'databases_registers' as const]]);

/**
 * A screening session on the synthetic fixtures (tests/fixtures/README.md):
 * records are named by their case label, every action gets a later timestamp.
 */
class Session {
  batches: ImportBatch[] = [];
  records: BibRecord[] = [];
  dedup: DedupDecision[] = [];
  decisions: Decision[] = [];
  groups: DuplicateGroup[] = [];
  private tick = 0;
  private ids = 0;

  private now = () => `2026-10-01T10:00:${String(++this.tick).padStart(2, '0')}.000Z`;

  importFile(path: string, format: ImportFormat) {
    const batch = { id: path, importedAt: this.now() } as ImportBatch;
    this.batches.push(batch);
    for (const [index, parsed] of parseFixture(path, format).records.entries()) {
      this.records.push({
        id: labelOf(parsed.csl.abstract) ?? `${path}-${index}`,
        projectId: 'p',
        sourceRunId: 'run',
        importBatchId: batch.id,
        sourceLine: parsed.line,
        csl: parsed.csl,
        raw: parsed.raw,
        ...(parsed.doi && { doi: parsed.doi }),
        ...(parsed.pmid && { pmid: parsed.pmid }),
      });
    }
    this.recompute();
  }

  dedupDecision(value: DedupDecision['value'], ...recordIds: string[]) {
    this.dedup.push({
      id: `dd-${++this.ids}`,
      projectId: 'p',
      recordIds,
      value,
      reviewerId: 'rev',
      timestamp: this.now(),
    });
    this.recompute();
  }

  private recompute() {
    const result = deduplicate(this.records, this.dedup);
    this.groups = assignGroupIds('p', result.groups, this.groups, () => `g-${++this.ids}`);
  }

  get evaluated() {
    const ordered = orderRecords(this.records, this.batches);
    return evaluateUnits(screeningUnits(ordered, this.groups, columns), this.decisions, 'rev', {
      ...settings,
    });
  }

  /** The current unit containing a record. */
  unitOf(recordId: string) {
    return this.evaluated.find((s) => s.unit.memberIds.includes(recordId))!;
  }

  decide(recordId: string, input: DecisionInput) {
    const result = createDecision(this.unitOf(recordId).unit, input, {
      projectId: 'p',
      reviewerId: 'rev',
      newId: () => `d-${++this.ids}`,
      now: this.now,
    });
    if (!result.ok) throw new Error(result.errors.join());
    this.decisions.push(result.value);
    return result.value;
  }
}

function startSession() {
  const session = new Session();
  session.importFile('synthetic/edge-cases.ris', 'ris');
  session.importFile('synthetic/edge-cases.nbib', 'nbib');
  session.importFile('synthetic/edge-cases.csv', 'csv');
  return session;
}

const TA = 'title_abstract' as const;
const include = { stage: TA, value: 'include' } as const;
const exclude = { stage: TA, value: 'exclude' } as const;

describe('screening units on the synthetic fixtures', () => {
  it('screens 13 units before and 12 after resolving the candidates C and D', () => {
    const session = startSession();
    expect(session.evaluated).toHaveLength(13);
    session.dedupDecision('merge', 'C1', 'C2');
    session.dedupDecision('separate', 'D1', 'D2');
    expect(session.evaluated).toHaveLength(12);
    expect(stageProgress(session.evaluated, TA)).toMatchObject({ total: 12, open: 12 });
  });
});

describe('the five rules for stable decisions (PRD §4)', () => {
  it('1: changing the primary record of group A keeps its decision', () => {
    const session = startSession();
    const made = session.decide('A1', exclude);
    expect(session.unitOf('A1').unit.primaryId).toBe('A1');

    session.dedupDecision('primary', 'A2');
    const after = session.unitOf('A1');
    expect(after.unit.primaryId).toBe('A2');
    expect(after.titleAbstract).toMatchObject({ state: 'decided', decision: made });
  });

  it('2a: merging C1 and C2 with the same decision keeps it', () => {
    const session = startSession();
    session.decide('C1', include);
    session.decide('C2', include);
    session.dedupDecision('merge', 'C1', 'C2');
    expect(session.unitOf('C1').titleAbstract).toMatchObject({
      state: 'decided',
      inherited: true,
    });
    expect(session.unitOf('C1').titleAbstract.decision?.value).toBe('include');
  });

  it('2b: contradicting decisions become a conflict, listed first, until decided once', () => {
    const session = startSession();
    session.decide('C1', include);
    session.decide('C2', exclude);
    session.dedupDecision('merge', 'C1', 'C2');
    const merged = session.unitOf('C1');
    expect(merged.titleAbstract.state).toBe('conflict');
    expect(merged.titleAbstract.conflicting.map((d) => d.value)).toEqual(['include', 'exclude']);
    expect(stageItems(session.evaluated, TA, 'all')[0]?.unit.key).toBe(merged.unit.key);
    expect(stageProgress(session.evaluated, TA).conflicts).toBe(1);

    session.decide('C2', exclude);
    expect(session.unitOf('C1').titleAbstract).toMatchObject({
      state: 'decided',
      inherited: false,
    });
  });

  it('2c: an undecided part adopts the decision of the decided part', () => {
    const session = startSession();
    session.decide('C1', include);
    session.dedupDecision('merge', 'C1', 'C2');
    expect(session.unitOf('C2').titleAbstract.decision?.value).toBe('include');
  });

  it('3: splitting group B keeps the decision on the shown part, the other part is open', () => {
    const session = startSession();
    const made = session.decide('B-ris', exclude);
    const shown = made.shownRecordId;
    const other = shown === 'B-ris' ? 'B-nbib' : 'B-ris';

    session.dedupDecision('separate', 'B-ris', 'B-nbib');
    expect(session.unitOf(shown).titleAbstract).toMatchObject({ state: 'decided', decision: made });
    const split = session.unitOf(other).titleAbstract;
    expect(split).toMatchObject({ state: 'open', suggestion: made });
    expect(stageItems(session.evaluated, TA, 'review').map((s) => s.unit.key)).toEqual([other]);

    const adopted = session.decide(other, exclude);
    expect(session.unitOf(other).titleAbstract).toMatchObject({
      state: 'decided',
      decision: adopted,
    });
    expect(session.unitOf(other).history.map((d) => d.id)).toEqual([adopted.id, made.id]);
  });

  it('4: a unit removed after screening keeps its decision in the history but does not count', () => {
    const session = startSession();
    const made = session.decide('K1', include);
    const before = stageProgress(session.evaluated, TA);
    session.decide('K1', { stage: 'pre_screening', value: 'remove_other', note: 'retracted' });

    const removed = session.unitOf('K1');
    expect(removed.removed).toBe(true);
    expect(removed.history.map((d) => d.id)).toContain(made.id);
    const after = stageProgress(session.evaluated, TA);
    expect(after.total).toBe(before.total - 1);
    expect(after.counts.include).toBe(before.counts.include - 1);
  });

  it('5: after a late import, duplicates of decided groups inherit, new records are open', () => {
    const session = startSession();
    session.decide('A1', exclude);
    session.importFile('synthetic/late-import.ris', 'ris');

    const a = session.unitOf('A3');
    expect(a.unit.memberIds).toEqual(expect.arrayContaining(['A1', 'A2', 'A3']));
    expect(a.titleAbstract).toMatchObject({ state: 'decided', inherited: true });
    expect(a.titleAbstract.decision?.value).toBe('exclude');
    expect(session.unitOf('N1').titleAbstract.state).toBe('open');
    expect(session.unitOf('N1').unit.key).toBe('N1');
  });
});

describe('real fixtures', () => {
  it('derives 278 screening units from 419 records quickly', () => {
    const session = new Session();
    session.importFile('real/scopus_ris.ris', 'ris');
    session.importFile('real/pubmed_medline.nbib', 'nbib');
    session.importFile('real/proquest_ris.ris', 'ris');
    expect(session.records).toHaveLength(419);
    const start = performance.now();
    const evaluated = session.evaluated;
    const elapsed = performance.now() - start;
    expect(evaluated).toHaveLength(278);
    expect(elapsed).toBeLessThan(200);
  });
});

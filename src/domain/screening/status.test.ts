import { describe, expect, it } from 'vitest';
import { indexDecisions, stageStatus, unitHistory } from './status';
import { decision, unit } from './testing';

const TA = 'title_abstract' as const;
const FT = 'full_text' as const;

describe('indexDecisions', () => {
  it('lists the decisions per record in chronological order, for one reviewer', () => {
    const earlier = decision('d1', ['a', 'b'], TA, 'include');
    const later = decision('d2', ['a'], TA, 'exclude');
    const other = decision('d3', ['a'], TA, 'maybe', { reviewerId: 'someone-else' });
    const index = indexDecisions([later, other, earlier], 'rev');
    expect(index.get('a')?.map((d) => d.id)).toEqual(['d1', 'd2']);
    expect(index.get('b')?.map((d) => d.id)).toEqual(['d1']);
  });

  it('orders equal timestamps by id so the result is deterministic', () => {
    const a = decision('x2', ['r'], TA, 'include', { timestamp: '2026-10-01T09:00:00.000Z' });
    const b = decision('x1', ['r'], TA, 'exclude', { timestamp: '2026-10-01T09:00:00.000Z' });
    expect(
      indexDecisions([a, b], 'rev')
        .get('r')
        ?.map((d) => d.id),
    ).toEqual(['x1', 'x2']);
  });
});

describe('stageStatus', () => {
  const status = (
    members: string[],
    decisions: ReturnType<typeof decision>[],
    stage: 'title_abstract' | 'full_text' = TA,
  ) => stageStatus(unit('u', ...members), indexDecisions(decisions, 'rev'), stage);

  it('is open without decisions', () => {
    expect(status(['a'], [])).toEqual({ state: 'open', conflicting: [], inherited: false });
  });

  it('uses the latest decision of the unit', () => {
    const d1 = decision('d1', ['a', 'b'], TA, 'include');
    const d2 = decision('d2', ['a', 'b'], TA, 'exclude');
    expect(status(['a', 'b'], [d1, d2])).toEqual({
      state: 'decided',
      decision: d2,
      conflicting: [],
      inherited: false,
    });
  });

  it('ignores decisions of the other stage', () => {
    expect(status(['a'], [decision('d', ['a'], FT, 'include')]).state).toBe('open');
  });

  it('treats reset as open', () => {
    const d1 = decision('d1', ['a'], TA, 'include');
    const d2 = decision('d2', ['a'], TA, 'reset', { undoOf: 'd1' });
    expect(status(['a'], [d1, d2]).state).toBe('open');
  });

  // Rule 1: the primary record changes, the members stay – nothing changes.
  it('rule 1: does not depend on which member is primary', () => {
    const d = decision('d', ['a', 'b'], TA, 'exclude');
    const index = indexDecisions([d], 'rev');
    const before = stageStatus({ memberIds: ['a', 'b'] }, index, TA);
    const after = stageStatus({ memberIds: ['b', 'a'] }, index, TA);
    expect(after).toEqual(before);
    expect(after.state).toBe('decided');
  });

  // Rule 2: merging two decided units.
  it('rule 2: adopts agreeing decisions of merged units', () => {
    const d1 = decision('d1', ['a'], TA, 'include');
    const d2 = decision('d2', ['b'], TA, 'include');
    const result = status(['a', 'b'], [d1, d2]);
    expect(result.state).toBe('decided');
    expect(result.decision).toBe(d2);
    expect(result.inherited).toBe(true);
  });

  it('rule 2: contradicting decisions of merged units are a conflict', () => {
    const d1 = decision('d1', ['a'], TA, 'include');
    const d2 = decision('d2', ['b'], TA, 'exclude');
    const result = status(['a', 'b'], [d1, d2]);
    expect(result.state).toBe('conflict');
    expect(result.conflicting).toEqual([d1, d2]);
    expect(result.decision).toBeUndefined();
  });

  it('rule 2: one decision for the merged unit resolves the conflict', () => {
    const d1 = decision('d1', ['a'], TA, 'include');
    const d2 = decision('d2', ['b'], TA, 'exclude');
    const d3 = decision('d3', ['a', 'b'], TA, 'exclude');
    expect(status(['a', 'b'], [d1, d2, d3])).toMatchObject({ state: 'decided', decision: d3 });
  });

  it('rule 2: in title/abstract screening only the value counts, not the optional reason', () => {
    const d1 = decision('d1', ['a'], TA, 'exclude', { reasonId: 'r1' });
    const d2 = decision('d2', ['b'], TA, 'exclude', { reasonId: 'r2' });
    expect(status(['a', 'b'], [d1, d2]).state).toBe('decided');
  });

  it('rule 2: in full-text screening different reasons or studies are a conflict', () => {
    const r1 = decision('d1', ['a'], FT, 'exclude', { reasonId: 'r1' });
    const r2 = decision('d2', ['b'], FT, 'exclude', { reasonId: 'r2' });
    expect(status(['a', 'b'], [r1, r2], FT).state).toBe('conflict');
    const s1 = decision('d3', ['c'], FT, 'include', { studyId: 's1' });
    const s2 = decision('d4', ['d'], FT, 'include');
    expect(status(['c', 'd'], [s1, s2], FT).state).toBe('conflict');
    const same = decision('d5', ['d'], FT, 'include', { studyId: 's1' });
    expect(status(['c', 'd'], [s1, s2, same], FT).state).toBe('decided');
  });

  // Rule 3: splitting a decided unit.
  it('rule 3: the part with the shown record keeps the decision', () => {
    const d = decision('d', ['a', 'b'], TA, 'exclude'); // shown: a
    expect(status(['a'], [d])).toMatchObject({ state: 'decided', decision: d, inherited: true });
  });

  it('rule 3: a split-off part is open and suggests the earlier decision', () => {
    const d = decision('d', ['a', 'b'], TA, 'exclude');
    expect(status(['b'], [d])).toEqual({
      state: 'open',
      conflicting: [],
      inherited: false,
      suggestion: d,
    });
  });

  it('rule 3: a new decision for the split-off part replaces the suggestion', () => {
    const d = decision('d', ['a', 'b'], TA, 'exclude');
    const adopted = decision('d2', ['b'], TA, 'exclude');
    expect(status(['b'], [d, adopted])).toMatchObject({ state: 'decided', decision: adopted });
  });

  it('rule 3: a reset is no suggestion', () => {
    const d = decision('d', ['a', 'b'], TA, 'reset');
    expect(status(['b'], [d]).suggestion).toBeUndefined();
  });

  it('rule 3: seen decisions win over suggestions from a former unit', () => {
    const old = decision('d1', ['x', 'b'], TA, 'exclude'); // shown x, b split off
    const fresh = decision('d2', ['a'], TA, 'include');
    expect(status(['a', 'b'], [old, fresh])).toMatchObject({ state: 'decided', decision: fresh });
  });

  // Rule 5: new records joining a decided unit.
  it('rule 5: an undecided new member inherits the decision of its unit', () => {
    const d = decision('d', ['a', 'b'], TA, 'exclude');
    expect(status(['a', 'b', 'new'], [d])).toMatchObject({
      state: 'decided',
      decision: d,
      inherited: true,
    });
  });
});

describe('unitHistory', () => {
  it('lists every decision touching a member, newest first, without duplicates', () => {
    const d1 = decision('d1', ['a', 'b'], TA, 'include');
    const d2 = decision('d2', ['b'], FT, 'exclude', { reasonId: 'r' });
    const d3 = decision('d3', ['z'], TA, 'include');
    const index = indexDecisions([d1, d2, d3], 'rev');
    expect(unitHistory({ memberIds: ['a', 'b'] }, index).map((d) => d.id)).toEqual(['d2', 'd1']);
  });
});

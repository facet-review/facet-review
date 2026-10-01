import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../testing';
import type { ScreeningSettings } from '../types';
import { evaluateUnits } from './stages';
import { includedCounts, planStudyAssignment, planStudyDetach, studyGroups } from './studies';
import { decision, unit } from './testing';

const settings: ScreeningSettings = {
  maybeToFullText: false,
  highlights: { include: [], exclude: [] },
};
const TA = 'title_abstract' as const;
const FT = 'full_text' as const;

function evaluate(extra: () => ReturnType<typeof decision>[] = () => []) {
  const units = [unit('a', 'a'), unit('b', 'b'), unit('c', 'c'), unit('d', 'd')];
  const base = [
    ...['a', 'b', 'c', 'd'].map((k) => decision(`t-${k}`, [k], TA, 'include')),
    decision('f-a', ['a'], FT, 'include'),
    decision('f-b', ['b'], FT, 'include'),
    decision('f-c', ['c'], FT, 'include'),
    decision('f-d', ['d'], FT, 'exclude', { reasonId: 'r' }),
  ];
  return evaluateUnits(units, [...base, ...extra()], 'rev', settings);
}

describe('studies', () => {
  it('counts one study per included report by default (1:1)', () => {
    expect(includedCounts(evaluate())).toEqual({ reports: 3, studies: 3 });
  });

  it('groups reports assigned to the same study', () => {
    const evals = evaluate(() => [
      decision('s1', ['a'], FT, 'include', { studyId: 'S' }),
      decision('s2', ['b'], FT, 'include', { studyId: 'S' }),
    ]);
    expect(includedCounts(evals)).toEqual({ reports: 3, studies: 2 });
    expect(studyGroups(evals).map((g) => [g.studyId, g.reports.map((r) => r.unit.key)])).toEqual([
      ['S', ['a', 'b']],
      [undefined, ['c']],
    ]);
  });

  it('creates a study for an anchor that has none and assigns both reports', () => {
    const evals = evaluate();
    const plan = planStudyAssignment(evals[1]!, evals[0]!, {
      newId: sequentialIds('S'),
      label: 'Weber 2024',
    });
    expect(plan).toEqual({
      study: { id: 'S-1', label: 'Weber 2024' },
      decisions: [
        { unit: evals[0]!.unit, input: { stage: FT, value: 'include', studyId: 'S-1' } },
        { unit: evals[1]!.unit, input: { stage: FT, value: 'include', studyId: 'S-1' } },
      ],
    });
  });

  it('reuses the study of an anchor that already has one', () => {
    const evals = evaluate(() => [decision('s1', ['a'], FT, 'include', { studyId: 'S' })]);
    const plan = planStudyAssignment(evals[2]!, evals[0]!, { newId: () => 'unused', label: '' });
    expect(plan).toEqual({
      decisions: [{ unit: evals[2]!.unit, input: { stage: FT, value: 'include', studyId: 'S' } }],
    });
  });

  it('refuses reports that are not included in full-text screening', () => {
    const evals = evaluate();
    expect(planStudyAssignment(evals[3]!, evals[0]!, { newId: () => 'x', label: '' })).toBe(
      undefined,
    );
    expect(planStudyAssignment(evals[0]!, evals[0]!, { newId: () => 'x', label: '' })).toBe(
      undefined,
    );
  });

  it('detaches a report into its own study', () => {
    const evals = evaluate(() => [decision('s1', ['a'], FT, 'include', { studyId: 'S' })]);
    expect(planStudyDetach(evals[0]!)).toEqual({
      unit: evals[0]!.unit,
      input: { stage: FT, value: 'include' },
    });
  });
});

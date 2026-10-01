import { describe, expect, it } from 'vitest';
import type { ScreeningSettings } from '../types';
import { evaluateUnits, fullTextGate, stageItems, stageProgress } from './stages';
import { decision, unit } from './testing';

const settings: ScreeningSettings = {
  maybeToFullText: false,
  highlights: { include: [], exclude: [] },
};
const TA = 'title_abstract' as const;
const FT = 'full_text' as const;
const other = (key: string) => ({ ...unit(key, key), column: 'other_methods' as const });

describe('evaluateUnits', () => {
  it('sends database units through title/abstract screening first', () => {
    const [u] = evaluateUnits([unit('a', 'a')], [], 'rev', settings);
    expect(u).toMatchObject({ removed: false, inTitleAbstract: true, inFullText: false });
  });

  it('sends units found only by other methods straight to full-text screening', () => {
    const [u] = evaluateUnits([other('c')], [], 'rev', settings);
    expect(u).toMatchObject({ inTitleAbstract: false, inFullText: true });
  });

  it('moves included units – and maybes only if configured – to full-text screening', () => {
    const units = [unit('a', 'a'), unit('b', 'b'), unit('c', 'c')];
    const decisions = [
      decision('d1', ['a'], TA, 'include'),
      decision('d2', ['b'], TA, 'maybe'),
      decision('d3', ['c'], TA, 'exclude'),
    ];
    const inFullText = (s: ScreeningSettings) =>
      evaluateUnits(units, decisions, 'rev', s).map((u) => u.inFullText);
    expect(inFullText(settings)).toEqual([true, false, false]);
    expect(inFullText({ ...settings, maybeToFullText: true })).toEqual([true, true, false]);
  });

  // Rule 4: removed afterwards – decision stays in the history, but does not count.
  it('rule 4: removed units leave both stages but keep their history', () => {
    const decisions = [
      decision('d1', ['a'], TA, 'include'),
      decision('d2', ['a'], 'pre_screening', 'remove_other', { note: 'retracted' }),
    ];
    const [u] = evaluateUnits([unit('a', 'a')], decisions, 'rev', settings);
    expect(u).toMatchObject({ removed: true, inTitleAbstract: false, inFullText: false });
    expect(u?.titleAbstract.decision?.id).toBe('d1');
    expect(u?.history.map((d) => d.id)).toEqual(['d2', 'd1']);
  });

  it('rule 4: restoring a removed unit brings its earlier decision back', () => {
    const decisions = [
      decision('d1', ['a'], TA, 'include'),
      decision('d2', ['a'], 'pre_screening', 'remove_automation', { note: 'tool' }),
      decision('d3', ['a'], 'pre_screening', 'reset'),
    ];
    const [u] = evaluateUnits([unit('a', 'a')], decisions, 'rev', settings);
    expect(u).toMatchObject({ removed: false, inFullText: true });
  });

  it('keeps a full-text decision in the history when stage 1 changes, without counting it', () => {
    const decisions = [
      decision('d1', ['a'], TA, 'include'),
      decision('d2', ['a'], FT, 'include'),
      decision('d3', ['a'], TA, 'exclude'),
    ];
    const [u] = evaluateUnits([unit('a', 'a')], decisions, 'rev', settings);
    expect(u?.inFullText).toBe(false);
    expect(stageProgress([u!], FT).total).toBe(0);
    expect(u?.fullText.decision?.id).toBe('d2');
  });
});

describe('stageItems and stageProgress', () => {
  const units = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => unit(k, k));
  units.push(unit('cd', 'c2', 'd2')); // merged unit with a conflict
  units.push(unit('split', 's2')); // split-off part
  const decisions = [
    decision('d1', ['a'], TA, 'include'),
    decision('d2', ['b'], TA, 'exclude'),
    decision('d3', ['c'], TA, 'maybe'),
    decision('d4', ['c2'], TA, 'include'),
    decision('d5', ['d2'], TA, 'exclude'),
    decision('d6', ['s1', 's2'], TA, 'exclude'),
  ];
  const evals = evaluateUnits(units, decisions, 'rev', settings);
  const keys = (filter: Parameters<typeof stageItems>[2]) =>
    stageItems(evals, TA, filter).map((u) => u.unit.key);

  it('lists conflicts first, then split-off parts, then everything else in order', () => {
    expect(keys('all')).toEqual(['cd', 'split', 'a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('filters by status; conflicts and split-off parts count as open', () => {
    expect(keys('open')).toEqual(['cd', 'split', 'd', 'e', 'f']);
    expect(keys('conflict')).toEqual(['cd']);
    expect(keys('review')).toEqual(['split']);
    expect(keys('include')).toEqual(['a']);
    expect(keys('exclude')).toEqual(['b']);
    expect(keys('maybe')).toEqual(['c']);
    expect(keys('not_retrieved')).toEqual([]);
  });

  it('counts progress per stage', () => {
    expect(stageProgress(evals, TA)).toEqual({
      total: 8,
      decided: 3,
      open: 5,
      conflicts: 1,
      review: 1,
      counts: { include: 1, exclude: 1, maybe: 1, not_retrieved: 0 },
    });
  });

  it('counts full-text outcomes', () => {
    const ft = evaluateUnits(
      [unit('a', 'a'), unit('b', 'b'), unit('c', 'c')],
      [
        decision('t1', ['a'], TA, 'include'),
        decision('t2', ['b'], TA, 'include'),
        decision('t3', ['c'], TA, 'include'),
        decision('f1', ['a'], FT, 'not_retrieved'),
        decision('f2', ['b'], FT, 'exclude', { reasonId: 'r' }),
      ],
      'rev',
      settings,
    );
    expect(stageProgress(ft, FT)).toMatchObject({
      total: 3,
      decided: 2,
      open: 1,
      counts: { include: 0, exclude: 1, maybe: 0, not_retrieved: 1 },
    });
    expect(stageItems(ft, FT, 'not_retrieved').map((u) => u.unit.key)).toEqual(['a']);
  });
});

describe('fullTextGate', () => {
  const units = [unit('a', 'a'), unit('b', 'b'), unit('c', 'c')];

  it('locks full-text screening while maybes are unresolved (PRD Modul 4)', () => {
    const decisions = [decision('d1', ['a'], TA, 'maybe'), decision('d2', ['b'], TA, 'include')];
    const evals = evaluateUnits(units, decisions, 'rev', settings);
    expect(fullTextGate(evals, settings)).toEqual({
      locked: true,
      maybes: 1,
      openTitleAbstract: 1,
    });
  });

  it('does not lock when maybes are taken along or resolved; open records only warn', () => {
    const decisions = [decision('d1', ['a'], TA, 'maybe')];
    const evals = evaluateUnits(units, decisions, 'rev', { ...settings, maybeToFullText: true });
    expect(fullTextGate(evals, { ...settings, maybeToFullText: true })).toEqual({
      locked: false,
      maybes: 1,
      openTitleAbstract: 2,
    });
  });
});

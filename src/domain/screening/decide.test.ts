import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../testing';
import { createDecision, reasonInUse, undoLast, validateDecision } from './decide';
import { decision } from './testing';

const ctx = {
  projectId: 'p',
  reviewerId: 'rev',
  newId: sequentialIds('d'),
  now: () => '2026-10-01T12:00:00.000Z',
};
const unit = { primaryId: 'b', memberIds: ['a', 'b'] };

describe('validateDecision', () => {
  it('accepts the values of each stage only', () => {
    expect(validateDecision({ stage: 'title_abstract', value: 'maybe' })).toEqual([]);
    expect(validateDecision({ stage: 'title_abstract', value: 'not_retrieved' })).toEqual([
      'invalidValue',
    ]);
    expect(validateDecision({ stage: 'full_text', value: 'maybe' })).toEqual(['invalidValue']);
    expect(validateDecision({ stage: 'full_text', value: 'not_retrieved' })).toEqual([]);
    expect(validateDecision({ stage: 'pre_screening', value: 'include' })).toEqual([
      'invalidValue',
    ]);
    for (const stage of ['pre_screening', 'title_abstract', 'full_text'] as const)
      expect(validateDecision({ stage, value: 'reset' })).toEqual([]);
  });

  it('requires an exclusion reason in full-text screening only', () => {
    expect(validateDecision({ stage: 'full_text', value: 'exclude' })).toEqual(['reasonRequired']);
    expect(validateDecision({ stage: 'full_text', value: 'exclude', reasonId: 'r' })).toEqual([]);
    expect(validateDecision({ stage: 'title_abstract', value: 'exclude' })).toEqual([]);
    expect(validateDecision({ stage: 'title_abstract', value: 'exclude', reasonId: 'r' })).toEqual(
      [],
    );
  });

  it('allows a reason only for exclusions and a study only for full-text inclusions', () => {
    expect(validateDecision({ stage: 'title_abstract', value: 'include', reasonId: 'r' })).toEqual([
      'reasonNotAllowed',
    ]);
    expect(validateDecision({ stage: 'full_text', value: 'include', studyId: 's' })).toEqual([]);
    expect(validateDecision({ stage: 'title_abstract', value: 'include', studyId: 's' })).toEqual([
      'studyNotAllowed',
    ]);
  });

  it('requires a note when removing records before screening', () => {
    expect(validateDecision({ stage: 'pre_screening', value: 'remove_other' })).toEqual([
      'noteRequired',
    ]);
    expect(validateDecision({ stage: 'pre_screening', value: 'remove_other', note: '  ' })).toEqual(
      ['noteRequired'],
    );
    expect(
      validateDecision({ stage: 'pre_screening', value: 'remove_automation', note: 'ASReview' }),
    ).toEqual([]);
  });
});

describe('createDecision', () => {
  it('records all members, the shown record and the reviewer', () => {
    const result = createDecision(
      unit,
      { stage: 'title_abstract', value: 'exclude', note: '  off topic ' },
      ctx,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        id: 'd-1',
        projectId: 'p',
        recordIds: ['a', 'b'],
        shownRecordId: 'b',
        reviewerId: 'rev',
        stage: 'title_abstract',
        value: 'exclude',
        note: 'off topic',
        timestamp: '2026-10-01T12:00:00.000Z',
      },
    });
  });

  it('drops empty optional fields', () => {
    const result = createDecision(unit, { stage: 'title_abstract', value: 'maybe', note: '' }, ctx);
    expect(result.ok && result.value).not.toHaveProperty('note');
  });

  it('refuses invalid decisions', () => {
    expect(createDecision(unit, { stage: 'full_text', value: 'exclude' }, ctx)).toEqual({
      ok: false,
      errors: ['reasonRequired'],
    });
  });
});

describe('undoLast', () => {
  const TA = 'title_abstract' as const;

  it('restores the previous decision of the same record', () => {
    const d1 = decision('d1', ['a'], TA, 'include');
    const d2 = decision('d2', ['a'], TA, 'exclude', { reasonId: 'r', note: 'n' });
    expect(undoLast([d1, d2], TA, 'rev')).toEqual({
      target: d2,
      unit: { memberIds: ['a'], primaryId: 'a' },
      input: { stage: TA, value: 'include', undoOf: 'd2' },
    });
  });

  it('resets to open when there was no earlier decision', () => {
    const d1 = decision('d1', ['a', 'b'], TA, 'exclude', { reasonId: 'r' });
    expect(undoLast([d1], TA, 'rev')?.input).toEqual({ stage: TA, value: 'reset', undoOf: 'd1' });
  });

  it('steps further back on repeated undo and never undoes an undo', () => {
    const d1 = decision('d1', ['a'], TA, 'include');
    const d2 = decision('d2', ['b'], TA, 'exclude');
    const u2 = decision('u2', ['b'], TA, 'reset', { undoOf: 'd2' });
    expect(undoLast([d1, d2, u2], TA, 'rev')?.target).toBe(d1);
    const u1 = decision('u1', ['a'], TA, 'reset', { undoOf: 'd1' });
    expect(undoLast([d1, d2, u2, u1], TA, 'rev')).toBeUndefined();
  });

  it('restores the state an undo had produced', () => {
    const d1 = decision('d1', ['a'], TA, 'include');
    const u1 = decision('u1', ['a'], TA, 'reset', { undoOf: 'd1' });
    const d3 = decision('d3', ['a'], TA, 'exclude');
    expect(undoLast([d1, u1, d3], TA, 'rev')?.input).toEqual({
      stage: TA,
      value: 'reset',
      undoOf: 'd3',
    });
  });

  it('carries reason and study of a restored full-text decision', () => {
    const d1 = decision('d1', ['a'], 'full_text', 'include', { studyId: 's' });
    const d2 = decision('d2', ['a'], 'full_text', 'exclude', { reasonId: 'r' });
    expect(undoLast([d1, d2], 'full_text', 'rev')?.input).toEqual({
      stage: 'full_text',
      value: 'include',
      studyId: 's',
      undoOf: 'd2',
    });
  });

  it('only looks at the given stage and reviewer', () => {
    const ft = decision('d1', ['a'], 'full_text', 'include');
    const other = decision('d2', ['a'], TA, 'include', { reviewerId: 'x' });
    expect(undoLast([ft, other], TA, 'rev')).toBeUndefined();
  });
});

describe('reasonInUse', () => {
  it('detects exclusion reasons referenced by any decision', () => {
    const decisions = [decision('d1', ['a'], 'full_text', 'exclude', { reasonId: 'r1' })];
    expect(reasonInUse(decisions, 'r1')).toBe(true);
    expect(reasonInUse(decisions, 'r2')).toBe(false);
  });
});

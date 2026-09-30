import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../testing';
import {
  addReason,
  createDefaultReasons,
  moveReason,
  removeReason,
  renameReason,
  sortedReasons,
} from './exclusionReasons';

const reasons = createDefaultReasons(['A', 'B', 'C'], sequentialIds('r'));

describe('createDefaultReasons', () => {
  it('creates ordered reasons with fresh ids', () => {
    expect(reasons).toEqual([
      { id: 'r-1', label: 'A', order: 0 },
      { id: 'r-2', label: 'B', order: 1 },
      { id: 'r-3', label: 'C', order: 2 },
    ]);
  });
});

describe('exclusion reason operations', () => {
  it('adds a reason at the end', () => {
    const next = addReason(reasons, 'D', () => 'new');
    expect(next.at(-1)).toEqual({ id: 'new', label: 'D', order: 3 });
  });

  it('renames a reason by id', () => {
    expect(renameReason(reasons, 'r-2', 'Beta').map((r) => r.label)).toEqual(['A', 'Beta', 'C']);
  });

  it('removes a reason and renumbers the order', () => {
    expect(removeReason(reasons, 'r-1')).toEqual([
      { id: 'r-2', label: 'B', order: 0 },
      { id: 'r-3', label: 'C', order: 1 },
    ]);
  });

  it('moves a reason up and down', () => {
    expect(moveReason(reasons, 'r-3', -1).map((r) => r.id)).toEqual(['r-1', 'r-3', 'r-2']);
    expect(moveReason(reasons, 'r-1', 1).map((r) => r.id)).toEqual(['r-2', 'r-1', 'r-3']);
  });

  it('ignores moves beyond the edges and unknown ids', () => {
    expect(moveReason(reasons, 'r-1', -1)).toEqual(reasons);
    expect(moveReason(reasons, 'r-3', 1)).toEqual(reasons);
    expect(moveReason(reasons, 'missing', 1)).toEqual(reasons);
  });

  it('sorts by order regardless of array position', () => {
    const shuffled = [reasons[2]!, reasons[0]!, reasons[1]!];
    expect(sortedReasons(shuffled).map((r) => r.id)).toEqual(['r-1', 'r-2', 'r-3']);
  });
});

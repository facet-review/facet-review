import { describe, expect, it } from 'vitest';
import { moveItem, removeAt, updateAt } from './list';

describe('moveItem', () => {
  it('moves an item forward and backward', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns an equal copy for out-of-range or identical positions', () => {
    const list = ['a', 'b'];
    expect(moveItem(list, 0, 5)).toEqual(['a', 'b']);
    expect(moveItem(list, -1, 0)).toEqual(['a', 'b']);
    expect(moveItem(list, 1, 1)).toEqual(['a', 'b']);
  });

  it('does not mutate the input', () => {
    const list = ['a', 'b'];
    moveItem(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('updateAt / removeAt', () => {
  it('replaces the item at an index', () => {
    expect(updateAt(['a', 'b'], 1, 'x')).toEqual(['a', 'x']);
    expect(updateAt(['a'], 3, 'x')).toEqual(['a']);
  });

  it('removes the item at an index', () => {
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(removeAt(['a'], 3)).toEqual(['a']);
  });
});

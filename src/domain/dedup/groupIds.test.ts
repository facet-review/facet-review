import { describe, expect, it } from 'vitest';
import { sequentialIds } from '../testing';
import type { DuplicateGroup } from '../types';
import { assignGroupIds } from './groupIds';
import type { DedupGroupResult } from './dedup';

const result = (primary: string, ...others: string[]): DedupGroupResult => ({
  primaryRecordId: primary,
  memberIds: [primary, ...others],
  rule: 'doi',
  links: others.map((b) => ({ a: primary, b, rule: 'doi' as const })),
});

describe('assignGroupIds', () => {
  it('keeps the id of a group whose primary record is unchanged', () => {
    const existing: DuplicateGroup[] = [{ id: 'g-old', projectId: 'p', ...result('r1', 'r2') }];
    const groups = assignGroupIds(
      'p',
      [result('r1', 'r2', 'r3'), result('r7', 'r8')],
      existing,
      sequentialIds('g'),
    );
    expect(groups.map((g) => [g.id, g.projectId, g.memberIds])).toEqual([
      ['g-old', 'p', ['r1', 'r2', 'r3']],
      ['g-1', 'p', ['r7', 'r8']],
    ]);
  });
});

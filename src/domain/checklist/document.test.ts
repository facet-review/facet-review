import { describe, expect, it } from 'vitest';
import { checklistDocument } from './document';

describe('checklistDocument', () => {
  const entries = [
    { projectId: 'p', itemId: '6', status: 'done' as const, location: 'p. 4, Table 1' },
    { projectId: 'p', itemId: '12', status: 'na' as const },
    { projectId: 'p', itemId: '13a', status: 'na' as const, location: 'Appendix B' },
  ];

  it('follows the original: sections, then one row per item with its location', () => {
    const doc = checklistDocument(entries, 'en', 'Not applicable');
    expect(doc.map((s) => s.section)).toEqual([
      'TITLE',
      'ABSTRACT',
      'INTRODUCTION',
      'METHODS',
      'RESULTS',
      'DISCUSSION',
      'OTHER INFORMATION',
    ]);
    const methods = doc[3]!.rows;
    expect(methods.find((r) => r.id === '6')).toMatchObject({
      topic: 'Information sources',
      location: 'p. 4, Table 1',
    });
  });

  it('writes "not applicable" only where no location was given', () => {
    const rows = checklistDocument(entries, 'en', 'Not applicable').flatMap((s) => s.rows);
    expect(rows.find((r) => r.id === '12')?.location).toBe('Not applicable');
    expect(rows.find((r) => r.id === '13a')?.location).toBe('Appendix B');
    expect(rows.find((r) => r.id === '1')?.location).toBe('');
  });

  it('shows a topic once for its sub-items (13a–13f) and uses German texts on request', () => {
    const rows = checklistDocument([], 'de', 'Nicht zutreffend').flatMap((s) => s.rows);
    const synthesis = rows.filter((r) => r.id.startsWith('13'));
    expect(synthesis.map((r) => r.showTopic)).toEqual([true, false, false, false, false, false]);
    expect(rows[0]?.topic).toBe('Titel');
  });
});

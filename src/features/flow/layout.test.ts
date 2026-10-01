import { describe, expect, it } from 'vitest';
import type { FlowLabelKey } from '../../domain/flow/labels';
import type { Count, FlowCounts } from '../../domain/flow/types';
import type { FlowVariant } from '../../domain/types';
import { flowLayout, wrap } from './layout';

const c = (n: number): Count => ({ n, recordIds: Array.from({ length: n }, (_, i) => `r${i}`) });
const retrieval = {
  sought: c(7),
  notRetrieved: c(1),
  assessed: c(6),
  reportsExcluded: [
    { reasonId: 'pop', label: 'Wrong population', ...c(0) },
    { reasonId: 'design', label: 'Wrong study design', ...c(2) },
    { reasonId: 'lang', label: 'Wrong language', ...c(1) },
  ],
  reportsExcludedTotal: c(3),
  included: c(3),
  open: c(0),
};

function counts(variant: FlowVariant, previous?: FlowCounts['previous']): FlowCounts {
  return {
    variant,
    detectedVariant: variant,
    databases: {
      databases: [
        { sourceId: 's1', label: 'Synthetic Scopus', type: 'database', ...c(12) },
        { sourceId: 's2', label: 'Synthetic PubMed', type: 'database', ...c(4) },
      ],
      registers: [],
      identified: c(16),
      duplicates: c(4),
      removedAutomation: c(0),
      removedOther: c(0),
      screened: c(12),
      excluded: c(5),
      openScreening: c(0),
      ...retrieval,
    },
    other: {
      methods: [{ method: 'citations', ...c(2) }],
      sources: [{ sourceId: 's3', label: 'Citations', type: 'citation_search', ...c(2) }],
      identified: c(2),
      inDatabaseUnits: c(1),
      duplicatesWithin: c(0),
      ...retrieval,
    },
    reports: c(3),
    studies: { ...c(2), groups: [] },
    ...(previous && { previous }),
    checks: [],
  };
}

const labels = (key: FlowLabelKey) => `[${key}]`;
/** Labels contain no-break spaces in "(n = …)"; compare with ordinary ones. */
const plain = (text: string) => text.replace(/\u00A0/g, ' ');
const layout = (variant: FlowVariant, previous?: FlowCounts['previous'], de = false) =>
  flowLayout(counts(variant, previous), labels, { workingTranslation: de });

function overlaps(a: { x: number; y: number; w: number; h: number }, b: typeof a) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('wrap', () => {
  it('keeps no-break spaces together', () => {
    expect(wrap('Duplicate records removed (n\u00A0=\u00A03)', 130)).toEqual([
      'Duplicate records',
      'removed (n\u00A0=\u00A03)',
    ]);
    expect(wrap('removed (n\u00A0=\u00A03)', 60)).toEqual(['removed', '(n\u00A0=\u00A03)']);
  });

  it('wraps at word boundaries and splits words longer than a line', () => {
    // 100 px hold 14 characters.
    expect(wrap('Records identified from databases', 100)).toEqual([
      'Records',
      'identified',
      'from databases',
    ]);
    expect(wrap('a b', 200)).toEqual(['a b']);
    expect(wrap('x'.repeat(30), 80)).toEqual(['x'.repeat(11), 'x'.repeat(11), 'x'.repeat(8)]);
  });
});

describe('flowLayout', () => {
  const ids = (variant: FlowVariant) => layout(variant).boxes.map((b) => b.id);
  const base = [
    'db.identified',
    'db.removed',
    'db.screened',
    'db.excluded',
    'db.sought',
    'db.notRetrieved',
    'db.assessed',
    'db.reportsExcluded',
    'included',
  ];
  const otherBoxes = [
    'other.identified',
    'other.sought',
    'other.notRetrieved',
    'other.assessed',
    'other.reportsExcluded',
  ];

  it('draws the boxes of each of the four template variants', () => {
    expect(ids('new_db').sort()).toEqual([...base].sort());
    expect(ids('new_db_other').sort()).toEqual([...base, ...otherBoxes].sort());
    expect(ids('update_db').sort()).toEqual([...base, 'previous', 'total'].sort());
    expect(ids('update_db_other').sort()).toEqual(
      [...base, ...otherBoxes, 'previous', 'total'].sort(),
    );
  });

  it('never lets boxes overlap and keeps everything inside the canvas', () => {
    for (const variant of ['new_db', 'new_db_other', 'update_db', 'update_db_other'] as const) {
      const { boxes, width, height } = layout(variant, { studies: 3 });
      for (const [i, a] of boxes.entries()) {
        expect(a.x + a.w).toBeLessThanOrEqual(width);
        expect(a.y + a.h).toBeLessThanOrEqual(height);
        for (const b of boxes.slice(i + 1)) expect(overlaps(a, b), `${a.id}/${b.id}`).toBe(false);
      }
    }
  });

  it('shows the number per database and the reasons with n > 0 only', () => {
    const { boxes } = layout('new_db');
    const text = (id: string) => plain(boxes.find((b) => b.id === id)!.label);
    expect(text('db.identified')).toContain('Synthetic Scopus (n = 12)');
    expect(text('db.identified')).toContain('[databases] (n = 16)');
    expect(text('db.reportsExcluded')).toContain('Wrong study design (n = 2)');
    expect(text('db.reportsExcluded')).not.toContain('Wrong population');
  });

  it('links every number to its records for the drill-down', () => {
    const removed = layout('new_db').boxes.find((b) => b.id === 'db.removed')!;
    expect(removed.targets.map((t) => [t.key, t.count.n])).toEqual([
      ['db.duplicates', 4],
      ['db.automation', 0],
      ['db.removedOther', 0],
    ]);
  });

  it('marks manually entered numbers of update reviews and adds them to the total', () => {
    const { boxes } = layout('update_db', { studies: 4, reports: 6 });
    const previous = boxes.find((b) => b.id === 'previous')!;
    expect(previous.manual).toBe(true);
    expect(plain(previous.label)).toContain('(n = 4) [manual]');
    expect(plain(boxes.find((b) => b.id === 'total')!.label)).toContain('[totalStudies] (n = 6)');
    expect(plain(boxes.find((b) => b.id === 'included')!.label)).toContain('[newStudies] (n = 2)');
  });

  it('shows "–" while previous numbers are missing', () => {
    const total = layout('update_db').boxes.find((b) => b.id === 'total')!;
    expect(plain(total.label)).toContain('[totalStudies] (n = –)');
  });

  it('notes other-method records reported with the databases', () => {
    const identified = layout('new_db_other').boxes.find((b) => b.id === 'other.identified')!;
    expect(plain(identified.label)).toContain('[otherInDatabaseUnits] (n = 1)');
  });

  it('ends with source and licence, and marks the German working translation', () => {
    expect(layout('new_db').footer.lines).toEqual(['[source]', '[license]']);
    expect(layout('new_db', undefined, true).footer.lines[0]).toBe('[workingTranslation]');
  });

  it('connects the boxes like the template', () => {
    expect(layout('new_db').arrows).toHaveLength(8);
    expect(layout('new_db_other').arrows).toHaveLength(13);
    expect(layout('update_db_other').arrows).toHaveLength(15);
  });
});

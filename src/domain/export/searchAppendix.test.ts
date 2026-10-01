import { describe, expect, it } from 'vitest';
import { makeLinkedBundle } from '../testing';
import type { Source, SourceRun } from '../types';
import {
  appendixMarkdown,
  codeFence,
  searchAppendix,
  type AppendixLabelKey,
} from './searchAppendix';

const t = (key: AppendixLabelKey) => `<${key}>`;

function data() {
  const bundle = makeLinkedBundle();
  const projectId = bundle.project.id;
  const sources: Source[] = [
    ...bundle.sources,
    {
      id: 'src-2',
      projectId,
      type: 'database',
      name: 'EBSCOhost',
      platform: 'EBSCO',
      databases: ['CINAHL', 'ERIC'],
    },
    { id: 'src-3', projectId, type: 'citation_search', name: 'Citation chasing' },
    { id: 'src-4', projectId, type: 'register', name: 'Unused register' },
  ];
  const runs: SourceRun[] = [
    { ...bundle.sourceRuns[0]!, limits: 'English; 2010–2026', importNote: 'Export limit' },
    {
      id: 'run-2',
      projectId,
      sourceId: 'src-2',
      date: '2026-09-02',
      searchString: 'S1  TI tutoring\n```\nS2  S1 AND grades',
      noLimits: true,
      reportedHits: 40,
    },
    {
      id: 'run-3',
      projectId,
      sourceId: 'src-2',
      date: '2026-09-20',
      searchString: 'update',
    },
    {
      id: 'run-4',
      projectId,
      sourceId: 'src-3',
      date: '2026-09-03',
      dateTo: '2026-09-10',
      searchString: '',
      citationDirection: 'both',
      seedDocuments: 'Doe 2020',
      tool: 'Citationchaser',
    },
  ];
  return {
    ...bundle,
    project: { ...bundle.project, searchMeta: { peerReview: 'PRESS by a librarian' } },
    sources,
    sourceRuns: runs,
  };
}

describe('searchAppendix', () => {
  const model = searchAppendix(data());

  it('groups sources by type in PRISMA-S order and leaves out sources never searched', () => {
    expect(model.groups.map((g) => [g.type, g.sources.map((s) => s.label)])).toEqual([
      ['database', ['EBSCOhost (CINAHL, ERIC)', 'Scopus']],
      ['citation_search', ['Citation chasing']],
    ]);
  });

  it('keeps search strings verbatim and counts imported records per run', () => {
    const ebsco = model.groups[0]!.sources[0]!;
    expect(ebsco.runs[0]?.searchString).toBe('S1  TI tutoring\n```\nS2  S1 AND grades');
    const scopus = model.groups[0]!.sources[1]!;
    expect(scopus.runs[0]).toMatchObject({
      imported: 2,
      reportedHits: 2,
      importNote: 'Export limit',
    });
  });

  it('distinguishes documented limits, "no limits" and "not documented" (PRISMA-S item 9)', () => {
    const [ebsco, scopus] = model.groups[0]!.sources;
    expect(scopus!.runs[0]!.limits).toEqual({ kind: 'text', text: 'English; 2010–2026' });
    expect(ebsco!.runs.map((r) => r.limits)).toEqual([{ kind: 'none' }, { kind: 'undocumented' }]);
    expect(model.groups[1]!.sources[0]!.runs[0]!.limits).toBeUndefined();
  });
});

describe('appendixMarkdown', () => {
  const md = appendixMarkdown(searchAppendix(data()), t);

  it('renders the search string in a code block that its own backticks cannot close', () => {
    expect(md).toContain('````\nS1  TI tutoring\n```\nS2  S1 AND grades\n````');
  });

  it('writes the three limit states as text', () => {
    expect(md).toContain('- <limits>: English; 2010–2026');
    expect(md).toContain('- <limits>: <noLimits>');
    expect(md).toContain('- <limits>: <undocumented>');
  });

  it('includes run details, project-wide information and the PRISMA-S attribution', () => {
    expect(md).toContain('- <date>: 2026-09-03 – 2026-09-10');
    expect(md).toContain('- <seedDocuments>: Doe 2020');
    expect(md).toContain('- <importNote>: Export limit');
    expect(md).toContain('<peerReview>: PRESS by a librarian');
    expect(md.trimEnd().split('\n').slice(-2)).toEqual(['<source2021>', '<license>']);
  });
});

describe('codeFence', () => {
  it('is longer than any backtick run in the text', () => {
    expect(codeFence('plain')).toBe('```');
    expect(codeFence('a ```` b')).toBe('`````');
  });
});

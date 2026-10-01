import { describe, expect, it } from 'vitest';
import { describeLimits, runFromQuery, type ProtocolLabel } from './protocol';
import type { OpenAlexQuery } from './types';

const label: ProtocolLabel = (key, vars) => (vars ? `${key}${JSON.stringify(vars)}` : key);

const base: OpenAlexQuery = {
  text: 'peer   tutoring\nAND library',
  field: 'title',
  types: [],
  languages: [],
  openAccessOnly: false,
};
const input = { id: 'r1', projectId: 'p1', sourceId: 's1', date: '2026-10-01', count: 42 };

describe('describeLimits', () => {
  it('is undefined without limits', () => {
    expect(describeLimits(base, label)).toBeUndefined();
  });

  it('describes a year range, types, languages and open access, then the raw filter', () => {
    expect(
      describeLimits(
        {
          ...base,
          fromYear: 2015,
          toYear: 2020,
          types: ['article'],
          languages: ['de'],
          openAccessOnly: true,
        },
        label,
      ),
    ).toBe(
      'years{"from":2015,"to":2020}; types{"list":"article"}; languages{"list":"de"}; openAccess\n' +
        'filter=from_publication_date:2015-01-01,to_publication_date:2020-12-31,type:article,language:de,is_oa:true',
    );
  });

  it('describes open-ended year limits', () => {
    expect(describeLimits({ ...base, fromYear: 2015 }, label)).toMatch(
      /^fromYear\{"year":2015\}\n/,
    );
    expect(describeLimits({ ...base, toYear: 2020 }, label)).toMatch(/^toYear\{"year":2020\}\n/);
  });
});

describe('runFromQuery', () => {
  it('documents the search automatically, verbatim and without credentials', () => {
    const run = runFromQuery(base, input, label);
    expect(run).toEqual({
      id: 'r1',
      projectId: 'p1',
      sourceId: 's1',
      date: '2026-10-01',
      searchString: 'title.search:peer   tutoring\nAND library',
      reportedHits: 42,
      noLimits: true,
      notes: expect.stringMatching(
        /^https:\/\/api\.openalex\.org\/works\?.*\ncursorNote$/s,
      ) as string,
    });
    expect(run.notes).not.toContain('mailto');
    expect(run.notes).not.toContain('api_key');
  });

  it('stores limits instead of noLimits when filters apply', () => {
    const run = runFromQuery({ ...base, openAccessOnly: true }, input, label);
    expect(run.noLimits).toBeUndefined();
    expect(run.limits).toBe('openAccess\nfilter=is_oa:true');
  });
});

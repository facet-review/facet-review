import { describe, expect, it } from 'vitest';
import {
  buildWorksUrl,
  limitFilters,
  searchExpression,
  SELECT_FIELDS,
  parseLanguages,
  validateQuery,
} from './query';
import type { OpenAlexQuery } from './types';

const base: OpenAlexQuery = {
  text: '"information literacy" AND tutoring',
  field: 'title_and_abstract',
  types: [],
  languages: [],
  openAccessOnly: false,
};

const params = (url: string) => new URL(url).searchParams;

describe('validateQuery', () => {
  it('accepts a plain search', () => {
    expect(validateQuery(base)).toEqual([]);
  });

  it('requires a search text', () => {
    expect(validateQuery({ ...base, text: '  ' })).toEqual(['textMissing']);
  });

  it('rejects commas in filter searches, which OpenAlex would split', () => {
    expect(validateQuery({ ...base, text: 'a, b' })).toEqual(['textComma']);
    expect(validateQuery({ ...base, field: 'title', text: 'a, b' })).toEqual(['textComma']);
    expect(validateQuery({ ...base, field: 'fulltext', text: 'a, b' })).toEqual([]);
  });

  it('checks the years', () => {
    expect(validateQuery({ ...base, fromYear: 2015.5 })).toEqual(['yearInvalid']);
    expect(validateQuery({ ...base, toYear: 99 })).toEqual(['yearInvalid']);
    expect(validateQuery({ ...base, fromYear: 2020, toYear: 2010 })).toEqual(['yearOrder']);
    expect(validateQuery({ ...base, fromYear: 2010, toYear: 2010 })).toEqual([]);
  });
});

describe('languages', () => {
  it('parses typed codes and accepts only two-letter codes', () => {
    expect(parseLanguages(' en, DE;de  fr ')).toEqual(['en', 'de', 'fr']);
    expect(parseLanguages('')).toEqual([]);
    expect(validateQuery({ ...base, languages: ['en', 'deu'] })).toEqual(['languageInvalid']);
  });
});

describe('limitFilters', () => {
  it('is empty without limits', () => {
    expect(limitFilters(base)).toEqual([]);
  });

  it('lists years, types, languages and open access in OpenAlex syntax', () => {
    expect(
      limitFilters({
        ...base,
        fromYear: 2015,
        toYear: 2026,
        types: ['article', 'review'],
        languages: ['en', 'de'],
        openAccessOnly: true,
      }),
    ).toEqual([
      'from_publication_date:2015-01-01',
      'to_publication_date:2026-12-31',
      'type:article|review',
      'language:en|de',
      'is_oa:true',
    ]);
  });
});

describe('searchExpression', () => {
  it('names the searched field', () => {
    expect(searchExpression(base)).toBe(
      'title_and_abstract.search:"information literacy" AND tutoring',
    );
    expect(searchExpression({ ...base, field: 'title', text: ' x ' })).toBe('title.search:x');
    expect(searchExpression({ ...base, field: 'fulltext' })).toBe(
      'search:"information literacy" AND tutoring',
    );
  });
});

describe('buildWorksUrl', () => {
  it('puts field searches into the filter, before the limits', () => {
    const url = buildWorksUrl({ ...base, fromYear: 2015 }, { perPage: 200, cursor: '*' });
    expect(url.startsWith('https://api.openalex.org/works?')).toBe(true);
    const query = params(url);
    expect(query.get('filter')).toBe(
      'title_and_abstract.search:"information literacy" AND tutoring,from_publication_date:2015-01-01',
    );
    expect(query.get('search')).toBeNull();
    expect(query.get('per-page')).toBe('200');
    expect(query.get('cursor')).toBe('*');
    expect(query.get('select')).toBe(SELECT_FIELDS.join(','));
  });

  it('uses the search parameter for full text and omits an empty filter', () => {
    const query = params(buildWorksUrl({ ...base, field: 'fulltext' }, { perPage: 5 }));
    expect(query.get('search')).toBe('"information literacy" AND tutoring');
    expect(query.has('filter')).toBe(false);
    expect(query.has('cursor')).toBe(false);
  });

  it('adds mailto and key only when given', () => {
    const without = params(buildWorksUrl(base, { perPage: 5, mailto: ' ', apiKey: '' }));
    expect(without.has('mailto')).toBe(false);
    expect(without.has('api_key')).toBe(false);
    const withBoth = params(
      buildWorksUrl(base, { perPage: 5, mailto: ' ada@example.org ', apiKey: 'k1' }),
    );
    expect(withBoth.get('mailto')).toBe('ada@example.org');
    expect(withBoth.get('api_key')).toBe('k1');
  });

  it('accepts a custom field selection', () => {
    const query = params(buildWorksUrl(base, { perPage: 5, select: ['id', 'display_name'] }));
    expect(query.get('select')).toBe('id,display_name');
  });
});

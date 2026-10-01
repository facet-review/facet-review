import { describe, expect, it } from 'vitest';
import { deduplicate } from '../../src/domain/dedup/dedup';
import { toRis } from '../../src/domain/export/ris';
import { parseFile } from '../../src/domain/import/parseFile';
import { fetchAllWorks, type ClientDeps } from '../../src/domain/openalex/client';
import { validateQuery } from '../../src/domain/openalex/query';
import type { OpenAlexQuery } from '../../src/domain/openalex/types';
import { worksToParseResult } from '../../src/domain/openalex/works';
import { parseFixture, readFixture } from './fixtures';

const json = (path: string): unknown => JSON.parse(readFixture(`openalex/${path}`));
const query = json('query.json') as OpenAlexQuery;

/** Serves the recorded pages by cursor, like the E2E route handler. */
const recorded: ClientDeps = {
  fetch: (url) => {
    const cursor = new URL(url).searchParams.get('cursor');
    const body = json(cursor === '*' ? 'page-1.json' : 'page-2.json');
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: () => Promise.resolve(body),
    });
  },
  sleep: () => Promise.resolve(),
};

async function load() {
  const { works, count } = await fetchAllWorks(query, {}, recorded, { perPage: 2 });
  return { count, parsed: worksToParseResult(works) };
}

describe('OpenAlex recorded answers (tests/fixtures/openalex/README.md)', () => {
  it('belong to a valid query', () => {
    expect(validateQuery(query)).toEqual([]);
  });

  it('load all pages and keep the reported count', async () => {
    const { count, parsed } = await load();
    expect(count).toBe(3);
    expect(parsed.records).toHaveLength(3);
    expect(parsed.warnings).toEqual([]);
  });

  it('map the edge cases', async () => {
    const [trial, chapter, preprint] = (await load()).parsed.records;
    expect(trial!.csl).toMatchObject({
      type: 'article-journal',
      author: [
        { family: 'Berger', given: 'Anna M.' },
        { family: 'van der Linden', given: 'José' },
      ],
      issued: { 'date-parts': [[2024, 3, 15]] },
      page: '101-118',
      abstract:
        'Peer tutoring improves information literacy. We compared structured tutoring with lectures (n = 120).',
    });
    expect(trial!.pmid).toBe('99000101');
    expect(chapter!.csl).toMatchObject({
      type: 'chapter',
      author: [{ literal: 'Bibliotheksverbund' }],
      page: '45',
      language: 'de',
    });
    expect(chapter!.doi).toBeUndefined();
    expect(chapter!.csl.abstract).toBeUndefined();
    expect(preprint!.csl).toMatchObject({ type: 'article', abstract: 'Search skills & peers.' });
    expect(preprint!.csl['container-title']).toBeUndefined();
  });

  it('are recognised as duplicates of file imports with the same DOI', async () => {
    const fromOpenAlex = (await load()).parsed.records;
    const fromFile = parseFixture('synthetic/edge-cases.ris', 'ris').records;
    const withIds = (records: typeof fromFile, prefix: string) =>
      records.map((r, i) => ({ id: `${prefix}${i}`, csl: r.csl, doi: r.doi, pmid: r.pmid }));
    const result = deduplicate([...withIds(fromFile, 'f'), ...withIds(fromOpenAlex, 'o')], []);
    const groupOfTrial = result.groups.find((group) => group.memberIds.includes('o0'));
    // Case A: A1 and A2 in the RIS file plus the OpenAlex trial, all DOI 10.5555/fr.test.0001.
    expect(groupOfTrial?.memberIds.sort()).toEqual(['f0', 'f1', 'o0']);
    expect(groupOfTrial?.rule).toBe('doi');
  });

  it('can be exported as RIS and read back', async () => {
    const records = (await load()).parsed.records;
    const back = parseFile(
      toRis(records.map((r) => ({ csl: r.csl, doi: r.doi, pmid: r.pmid }))),
      'ris',
    );
    expect(back.records.map((r) => r.csl.title)).toEqual(records.map((r) => r.csl.title));
  });
});

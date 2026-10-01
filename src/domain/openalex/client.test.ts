import { describe, expect, it, vi } from 'vitest';
import {
  countWorks,
  fetchAllWorks,
  MAX_RETRIES,
  OpenAlexError,
  REQUEST_INTERVAL_MS,
  type ClientDeps,
  type HttpResponse,
} from './client';
import type { OpenAlexQuery, OpenAlexResponse } from './types';

const query: OpenAlexQuery = {
  text: 'tutoring',
  field: 'title_and_abstract',
  types: [],
  languages: [],
  openAccessOnly: false,
};

function reply(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name] ?? null },
    json: () => Promise.resolve(body),
  };
}

const page = (count: number, ids: string[], next: string | null): OpenAlexResponse => ({
  meta: { count, next_cursor: next },
  results: ids.map((id) => ({ id, display_name: `Title ${id}` })),
});

/** Answers requests in order and records the URLs and pauses. */
function fakeDeps(responses: (HttpResponse | Error)[]) {
  const urls: string[] = [];
  const sleeps: number[] = [];
  const deps: ClientDeps = {
    fetch: (url) => {
      urls.push(url);
      const next = responses.shift();
      if (!next) throw new Error('unexpected request');
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  };
  return { deps, urls, sleeps };
}

const cursorOf = (url: string) => new URL(url).searchParams.get('cursor');

describe('countWorks', () => {
  it('returns the count and the first titles with one small request', async () => {
    const { deps, urls } = fakeDeps([reply(200, page(3, ['W1', 'W2'], null))]);
    await expect(countWorks(query, { mailto: 'a@b.org' }, deps)).resolves.toEqual({
      count: 3,
      preview: ['Title W1', 'Title W2'],
    });
    const params = new URL(urls[0]!).searchParams;
    expect(params.get('per-page')).toBe('5');
    expect(params.get('select')).toBe('id,display_name');
    expect(params.get('mailto')).toBe('a@b.org');
  });
});

describe('fetchAllWorks', () => {
  it('follows the cursor to the last page, pausing between requests', async () => {
    const { deps, urls, sleeps } = fakeDeps([
      reply(200, page(3, ['W1', 'W2'], 'c2')),
      reply(200, page(3, ['W3'], null)),
    ]);
    const progress = vi.fn();
    const result = await fetchAllWorks(query, {}, deps, { perPage: 2, onProgress: progress });
    expect(result.count).toBe(3);
    expect(result.works.map((work) => work.id)).toEqual(['W1', 'W2', 'W3']);
    expect(urls.map(cursorOf)).toEqual(['*', 'c2']);
    expect(sleeps).toEqual([REQUEST_INTERVAL_MS]);
    expect(progress.mock.calls).toEqual([
      [{ page: 1, pages: 2, loaded: 2, count: 3 }],
      [{ page: 2, pages: 2, loaded: 3, count: 3 }],
    ]);
  });

  it('stops at an empty page even if a cursor comes back', async () => {
    const { deps, urls } = fakeDeps([
      reply(200, page(1, ['W1'], 'c2')),
      reply(200, page(1, [], 'c3')),
    ]);
    const result = await fetchAllWorks(query, {}, deps);
    expect(result.works).toHaveLength(1);
    expect(urls).toHaveLength(2);
  });

  it('refuses searches above the limit before loading more', async () => {
    const { deps, urls } = fakeDeps([reply(200, page(11, ['W1'], 'c2'))]);
    const error = await fetchAllWorks(query, {}, deps, { limit: 10 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OpenAlexError);
    expect(error).toMatchObject({ code: 'tooMany', detail: 11 });
    expect(urls).toHaveLength(1);
  });

  it('waits Retry-After on 429 and retries', async () => {
    const { deps, sleeps } = fakeDeps([
      reply(429, { error: 'Rate limit exceeded' }, { 'Retry-After': '2' }),
      reply(200, page(1, ['W1'], null)),
    ]);
    const result = await fetchAllWorks(query, {}, deps);
    expect(result.works).toHaveLength(1);
    expect(sleeps).toEqual([2000]);
  });

  it('backs off exponentially on server errors and gives up after the last retry', async () => {
    const { deps, sleeps } = fakeDeps(
      Array.from({ length: MAX_RETRIES + 1 }, () => reply(503, {})),
    );
    await expect(fetchAllWorks(query, {}, deps)).rejects.toMatchObject({
      code: 'http',
      detail: 503,
    });
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  it('reports a persistent rate limit as such', async () => {
    const { deps } = fakeDeps(Array.from({ length: MAX_RETRIES + 1 }, () => reply(429, {})));
    await expect(fetchAllWorks(query, {}, deps)).rejects.toMatchObject({ code: 'rateLimited' });
  });

  it('caps very long Retry-After values', async () => {
    const { deps, sleeps } = fakeDeps([
      reply(429, {}, { 'Retry-After': '3600' }),
      reply(200, page(0, [], null)),
    ]);
    await fetchAllWorks(query, {}, deps);
    expect(sleeps).toEqual([60_000]);
  });

  it('does not retry client errors', async () => {
    const { deps } = fakeDeps([reply(400, { error: 'Invalid query' })]);
    await expect(fetchAllWorks(query, {}, deps)).rejects.toMatchObject({
      code: 'http',
      detail: 400,
    });
  });

  it('rejects answers that are not OpenAlex lists', async () => {
    const broken: HttpResponse = { ...reply(200, {}), json: () => Promise.reject(new Error('x')) };
    for (const response of [reply(200, { results: [] }), reply(200, null), broken]) {
      const { deps } = fakeDeps([response]);
      await expect(fetchAllWorks(query, {}, deps)).rejects.toMatchObject({ code: 'invalid' });
    }
  });

  it('distinguishes network failures from cancellation', async () => {
    const { deps } = fakeDeps([new TypeError('Failed to fetch')]);
    await expect(fetchAllWorks(query, {}, deps)).rejects.toMatchObject({ code: 'network' });

    const controller = new AbortController();
    const aborting: ClientDeps = {
      fetch: () => {
        controller.abort();
        return Promise.reject(new DOMException('aborted', 'AbortError'));
      },
      sleep: () => Promise.resolve(),
    };
    await expect(
      fetchAllWorks(query, {}, aborting, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'aborted' });
  });

  it('does not start when already cancelled', async () => {
    const { deps, urls } = fakeDeps([]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchAllWorks(query, {}, deps, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'aborted' });
    expect(urls).toHaveLength(0);
  });

  it('names the error in its message', () => {
    expect(new OpenAlexError('http', 500).message).toBe('OpenAlex: http (500)');
    expect(new OpenAlexError('network').message).toBe('OpenAlex: network');
  });
});

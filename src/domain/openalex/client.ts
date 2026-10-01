import { buildWorksUrl, MAX_IMPORT, PAGE_SIZE } from './query';
import type { OpenAlexCredentials, OpenAlexQuery, OpenAlexResponse, OpenAlexWork } from './types';

/** The parts of `fetch` the client needs – injected, so tests run against recorded answers. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export interface ClientDeps {
  fetch: (url: string, init: { signal?: AbortSignal }) => Promise<HttpResponse>;
  sleep: (ms: number) => Promise<void>;
}

export type OpenAlexErrorCode =
  'rateLimited' | 'http' | 'network' | 'invalid' | 'tooMany' | 'aborted';

export class OpenAlexError extends Error {
  readonly code: OpenAlexErrorCode;
  /** HTTP status, or the hit count for `tooMany`. */
  readonly detail: number | undefined;

  constructor(code: OpenAlexErrorCode, detail?: number) {
    super(`OpenAlex: ${code}${detail === undefined ? '' : ` (${detail})`}`);
    this.code = code;
    this.detail = detail;
  }
}

/** Pause between requests: well below the documented 10 requests per second. */
export const REQUEST_INTERVAL_MS = 150;
/** Retries after 429 or 5xx, waiting Retry-After or 1, 2, 4 s. */
export const MAX_RETRIES = 3;
const MAX_WAIT_MS = 60_000;

function retryDelay(response: HttpResponse, attempt: number): number {
  const header = response.headers.get('Retry-After');
  const seconds = header === null ? NaN : Number(header);
  const ms = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 1000 * 2 ** attempt;
  return Math.min(ms, MAX_WAIT_MS);
}

function isResponse(value: unknown): value is OpenAlexResponse {
  if (typeof value !== 'object' || value === null) return false;
  const { meta, results } = value as Partial<OpenAlexResponse>;
  return typeof meta?.count === 'number' && Array.isArray(results);
}

async function request(url: string, deps: ClientDeps, signal?: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new OpenAlexError('aborted');
    let response: HttpResponse;
    try {
      response = await deps.fetch(url, { signal });
    } catch {
      throw new OpenAlexError(signal?.aborted ? 'aborted' : 'network');
    }
    if (response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      if (!isResponse(body)) throw new OpenAlexError('invalid');
      return body;
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable) throw new OpenAlexError('http', response.status);
    if (attempt >= MAX_RETRIES) {
      throw new OpenAlexError(response.status === 429 ? 'rateLimited' : 'http', response.status);
    }
    await deps.sleep(retryDelay(response, attempt));
  }
}

/** Number of hits and the first titles, with one small request. */
export async function countWorks(
  query: OpenAlexQuery,
  credentials: OpenAlexCredentials,
  deps: ClientDeps,
  signal?: AbortSignal,
): Promise<{ count: number; preview: string[] }> {
  const url = buildWorksUrl(query, {
    ...credentials,
    perPage: 5,
    select: ['id', 'display_name'],
  });
  const body = await request(url, deps, signal);
  return {
    count: body.meta.count,
    preview: body.results.map((work) => work.display_name ?? '').filter(Boolean),
  };
}

export interface FetchProgress {
  page: number;
  pages: number;
  loaded: number;
  count: number;
}

/**
 * All works of a search, page by page with a cursor, one request at a time.
 * Refuses searches with more than `limit` hits before loading anything.
 */
export async function fetchAllWorks(
  query: OpenAlexQuery,
  credentials: OpenAlexCredentials,
  deps: ClientDeps,
  options: {
    signal?: AbortSignal;
    onProgress?: (progress: FetchProgress) => void;
    limit?: number;
    perPage?: number;
  } = {},
): Promise<{ works: OpenAlexWork[]; count: number }> {
  const limit = options.limit ?? MAX_IMPORT;
  const perPage = options.perPage ?? PAGE_SIZE;
  const works: OpenAlexWork[] = [];
  let cursor: string | null | undefined = '*';
  let count = 0;
  let page = 0;
  while (cursor) {
    if (page > 0) await deps.sleep(REQUEST_INTERVAL_MS);
    const body = await request(
      buildWorksUrl(query, { ...credentials, perPage, cursor }),
      deps,
      options.signal,
    );
    if (page === 0) {
      count = body.meta.count;
      if (count > limit) throw new OpenAlexError('tooMany', count);
    }
    page++;
    works.push(...body.results);
    options.onProgress?.({
      page,
      // The count can change while paging; never report fewer pages than loaded.
      pages: Math.max(page, Math.ceil(count / perPage)),
      loaded: works.length,
      count,
    });
    // An empty page ends the walk even if a cursor is returned.
    cursor = body.results.length > 0 ? body.meta.next_cursor : null;
  }
  return { works, count };
}

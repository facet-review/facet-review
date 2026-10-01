/**
 * The parts of the OpenAlex API (https://docs.openalex.org) that Facet Review
 * uses. Only the fields requested via `select` are typed; everything may be null.
 */

export const OPENALEX_API = 'https://api.openalex.org';

export type SearchField = 'title_and_abstract' | 'title' | 'fulltext';
export const SEARCH_FIELDS: readonly SearchField[] = ['title_and_abstract', 'title', 'fulltext'];

/** Work types offered as a filter (OpenAlex `type` values). */
export const WORK_TYPES = [
  'article',
  'review',
  'preprint',
  'book-chapter',
  'book',
  'dissertation',
  'report',
  'dataset',
] as const;
export type WorkType = (typeof WORK_TYPES)[number];

/** A search as entered in the form. */
export interface OpenAlexQuery {
  text: string;
  field: SearchField;
  fromYear?: number;
  toYear?: number;
  types: string[];
  /** ISO 639-1 codes, e.g. "en", "de". */
  languages: string[];
  openAccessOnly: boolean;
}

/** Per-browser settings sent along with every request (never stored in a project). */
export interface OpenAlexCredentials {
  mailto?: string;
  apiKey?: string;
}

export interface OpenAlexAuthorship {
  author?: { display_name?: string | null } | null;
  raw_author_name?: string | null;
}

export interface OpenAlexWork {
  id: string;
  doi?: string | null;
  display_name?: string | null;
  title?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  type?: string | null;
  language?: string | null;
  ids?: { pmid?: string | null; doi?: string | null } | null;
  authorships?: OpenAlexAuthorship[] | null;
  primary_location?: {
    landing_page_url?: string | null;
    source?: { display_name?: string | null } | null;
  } | null;
  biblio?: {
    volume?: string | null;
    issue?: string | null;
    first_page?: string | null;
    last_page?: string | null;
  } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

export interface OpenAlexResponse {
  meta: { count: number; next_cursor?: string | null; per_page?: number };
  results: OpenAlexWork[];
}

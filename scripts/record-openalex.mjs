// Records real OpenAlex answers for the tests (tests/fixtures/openalex/README.md).
// Usage: node scripts/record-openalex.mjs [mailto]
// Runs the search of query.json with two results per page (so paging is exercised)
// and writes count.json, page-1.json and page-2.json. OpenAlex data is CC0.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DIR = resolve(import.meta.dirname, '../tests/fixtures/openalex');
const SELECT =
  'id,doi,display_name,publication_year,publication_date,type,language,ids,authorships,primary_location,biblio,abstract_inverted_index';
const FIELD = { title_and_abstract: 'title_and_abstract.search', title: 'title.search' };

const query = JSON.parse(await readFile(resolve(DIR, 'query.json'), 'utf8'));
const mailto = process.argv[2];

function url(perPage, select, cursor) {
  const params = new URLSearchParams();
  const filters = [];
  if (query.field === 'fulltext') params.set('search', query.text);
  else filters.push(`${FIELD[query.field]}:${query.text}`);
  if (query.fromYear) filters.push(`from_publication_date:${query.fromYear}-01-01`);
  if (query.toYear) filters.push(`to_publication_date:${query.toYear}-12-31`);
  if (query.types.length) filters.push(`type:${query.types.join('|')}`);
  if (query.languages.length) filters.push(`language:${query.languages.join('|')}`);
  if (query.openAccessOnly) filters.push('is_oa:true');
  if (filters.length) params.set('filter', filters.join(','));
  params.set('select', select);
  params.set('per-page', String(perPage));
  if (cursor) params.set('cursor', cursor);
  if (mailto) params.set('mailto', mailto);
  return `https://api.openalex.org/works?${params}`;
}

async function get(target) {
  const response = await fetch(target);
  if (!response.ok) throw new Error(`${response.status} for ${target}`);
  return response.json();
}

const write = (name, body) =>
  writeFile(resolve(DIR, name), `${JSON.stringify(body, null, 2)}\n`, 'utf8');

const count = await get(url(5, 'id,display_name'));
await write('count.json', count);
const first = await get(url(2, SELECT, '*'));
await write('page-1.json', first);
const second = await get(url(2, SELECT, first.meta.next_cursor));
// Keep the recording to two pages: the second one is presented as the last.
second.meta.next_cursor = null;
await write('page-2.json', second);
console.log(
  `Recorded: ${count.meta.count} hits; pages of ${first.results.length} + ${second.results.length}.`,
);
console.log('Now check the expectations in the unit and E2E tests by hand.');

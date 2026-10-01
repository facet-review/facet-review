import { describe, expect, it } from 'vitest';
import { recordLinks } from './links';

describe('recordLinks', () => {
  it('builds DOI, OpenAlex and Unpaywall links from the DOI, PubMed from the PMID', () => {
    expect(recordLinks({ doi: '10.1000/a b', pmid: '123' })).toEqual({
      doi: 'https://doi.org/10.1000/a%20b',
      openAlex: 'https://api.openalex.org/works/https://doi.org/10.1000/a%20b',
      unpaywall: 'https://unpaywall.org/10.1000/a%20b',
      pubmed: 'https://pubmed.ncbi.nlm.nih.gov/123/',
    });
  });

  it('returns no links without identifiers', () => {
    expect(recordLinks({})).toEqual({});
  });
});

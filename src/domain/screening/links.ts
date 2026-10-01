/**
 * Links for retrieving a full text. They are only followed when the reviewer
 * clicks them – the app itself sends nothing (principle 1; an OpenAlex
 * integration with OA status follows in milestone 7).
 */
export function recordLinks(record: { doi?: string; pmid?: string }) {
  const links: { doi?: string; openAlex?: string; unpaywall?: string; pubmed?: string } = {};
  if (record.doi) {
    const doi = encodeURI(record.doi);
    links.doi = `https://doi.org/${doi}`;
    links.openAlex = `https://api.openalex.org/works/https://doi.org/${doi}`;
    links.unpaywall = `https://unpaywall.org/${doi}`;
  }
  if (record.pmid)
    links.pubmed = `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(record.pmid)}/`;
  return links;
}

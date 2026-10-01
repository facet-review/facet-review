/** CSV target fields – kept free of the CSV parser so the UI can import them cheaply. */
export const CSV_FIELDS = [
  'title',
  'authors',
  'year',
  'container',
  'doi',
  'pmid',
  'abstract',
  'volume',
  'issue',
  'pages',
  'pageStart',
  'pageEnd',
  'keywords',
  'type',
  'language',
  'url',
  'publisher',
  'issn',
] as const;
export type CsvField = (typeof CSV_FIELDS)[number];

/** Column index per field; fields without a column are absent. */
export type CsvMapping = Partial<Record<CsvField, number>>;

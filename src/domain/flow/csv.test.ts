import { describe, expect, it } from 'vitest';
import { flowCsv, flowRows } from './csv';
import type { FlowLabelKey } from './labels';
import type { Count, FlowCounts } from './types';

const c = (n: number): Count => ({ n, recordIds: [] });
const retrieval = {
  sought: c(7),
  notRetrieved: c(1),
  assessed: c(6),
  reportsExcluded: [
    { reasonId: 'r1', label: 'Wrong population', ...c(0) },
    { reasonId: 'r2', label: 'Wrong "design", sic', ...c(3) },
  ],
  reportsExcludedTotal: c(3),
  included: c(3),
  open: c(0),
};
const counts: FlowCounts = {
  variant: 'update_db_other',
  detectedVariant: 'update_db_other',
  databases: {
    databases: [{ sourceId: 's', label: 'Scopus', type: 'database', ...c(16) }],
    registers: [],
    identified: c(16),
    duplicates: c(4),
    removedAutomation: c(0),
    removedOther: c(0),
    screened: c(12),
    excluded: c(5),
    openScreening: c(0),
    ...retrieval,
  },
  other: {
    methods: [{ method: 'citations', ...c(2) }],
    sources: [],
    identified: c(2),
    inDatabaseUnits: c(1),
    duplicatesWithin: c(0),
    ...retrieval,
    sought: c(1),
    notRetrieved: c(0),
    assessed: c(1),
    reportsExcluded: [],
    reportsExcludedTotal: c(0),
    included: c(1),
  },
  reports: c(4),
  studies: { ...c(3), groups: [] },
  previous: { studies: 2 },
  checks: [],
};
const labels = (key: FlowLabelKey) => `<${key}>`;

describe('flowRows', () => {
  it('lists every box with sources, methods and all reasons including 0', () => {
    const rows = flowRows(counts, labels);
    expect(rows).toContainEqual(['<databases>: Scopus', '16']);
    expect(rows).toContainEqual(['<reportsExcluded>: Wrong population', '0']);
    expect(rows).toContainEqual(['<headerOther>: <citations>', '2']);
    expect(rows).toContainEqual(['<headerOther>: <sought>', '1']);
    expect(rows).toContainEqual(['<previousStudies> <manual>', '2']);
    expect(rows).toContainEqual(['<previousReports> <manual>', '']);
    expect(rows).toContainEqual(['<totalStudies>', '5']);
    expect(rows).toContainEqual(['<totalReports>', '']);
    expect(rows.filter(([label]) => label === '<sought>')).toEqual([['<sought>', '7']]);
  });

  it('leaves out the right column and update boxes when the variant has none', () => {
    const rows = flowRows({ ...counts, variant: 'new_db', previous: undefined }, labels);
    expect(rows.some(([label]) => label?.includes('<headerOther>'))).toBe(false);
    expect(rows.some(([label]) => label?.startsWith('<previousStudies>'))).toBe(false);
    expect(rows).toContainEqual(['<studies>', '3']);
  });
});

describe('flowCsv', () => {
  it('quotes values and ends with source and licence (CC BY 4.0)', () => {
    const csv = flowCsv(counts, labels, { workingTranslation: true, delimiter: ',' });
    const lines = csv.trimEnd().split('\r\n');
    expect(lines[0]).toBe('\uFEFF"<csvBox>","<csvN>"');
    expect(csv).toContain('"<reportsExcluded>: Wrong ""design"", sic","3"');
    expect(lines.slice(-3)).toEqual(['"<workingTranslation>"', '"<source>"', '"<license>"']);
  });

  it('omits the working-translation note for the English original', () => {
    expect(flowCsv(counts, labels, { workingTranslation: false, delimiter: ';' })).not.toContain(
      'workingTranslation',
    );
  });
});

import { toCsv, type CsvDelimiter } from '../export/csv';
import type { FlowLabels } from './labels';
import type { FlowCounts, Retrieval } from './types';
import { hasOtherMethods, isUpdateVariant } from './variant';

type Row = [string, string];

const num = (n: number | undefined) => (n === undefined ? '' : String(n));

/** All numbers of the diagram as label/value rows, in reading order (left, right, included). */
export function flowRows(counts: FlowCounts, label: FlowLabels): Row[] {
  const db = counts.databases;
  const rows: Row[] = [];
  // Rows of the right column carry its heading, so both columns stay distinguishable.
  const retrieval = (column: Retrieval, prefix = '') => {
    rows.push(
      [prefix + label('sought'), num(column.sought.n)],
      [prefix + label('notRetrieved'), num(column.notRetrieved.n)],
      [prefix + label('assessed'), num(column.assessed.n)],
      [prefix + label('reportsExcluded'), num(column.reportsExcludedTotal.n)],
      ...column.reportsExcluded.map((reason): Row => [
        `${prefix}${label('reportsExcluded')}: ${reason.label}`,
        num(reason.n),
      ]),
    );
  };

  rows.push(
    [label('databases'), num(db.databases.reduce((sum, s) => sum + s.n, 0))],
    ...db.databases.map((s): Row => [`${label('databases')}: ${s.label}`, num(s.n)]),
    [label('registers'), num(db.registers.reduce((sum, s) => sum + s.n, 0))],
    ...db.registers.map((s): Row => [`${label('registers')}: ${s.label}`, num(s.n)]),
    [label('duplicates'), num(db.duplicates.n)],
    [label('automation'), num(db.removedAutomation.n)],
    [label('removedOther'), num(db.removedOther.n)],
    [label('screened'), num(db.screened.n)],
    [label('excluded'), num(db.excluded.n)],
  );
  retrieval(db);

  if (hasOtherMethods(counts.variant)) {
    const prefix = `${label('headerOther')}: `;
    rows.push(...counts.other.methods.map((m): Row => [prefix + label(m.method), num(m.n)]));
    retrieval(counts.other, prefix);
  }

  const update = isUpdateVariant(counts.variant);
  if (update) {
    const previous = counts.previous ?? {};
    const total = (a: number | undefined, b: number) => (a === undefined ? undefined : a + b);
    rows.push(
      [`${label('previousStudies')} ${label('manual')}`, num(previous.studies)],
      [`${label('previousReports')} ${label('manual')}`, num(previous.reports)],
      [label('newStudies'), num(counts.studies.n)],
      [label('newReports'), num(counts.reports.n)],
      [label('totalStudies'), num(total(previous.studies, counts.studies.n))],
      [label('totalReports'), num(total(previous.reports, counts.reports.n))],
    );
  } else {
    rows.push([label('studies'), num(counts.studies.n)], [label('reports'), num(counts.reports.n)]);
  }
  return rows;
}

/** CSV of the numbers, ending with source and licence of the template. */
export function flowCsv(
  counts: FlowCounts,
  label: FlowLabels,
  options: { workingTranslation: boolean; delimiter: CsvDelimiter },
): string {
  return toCsv(
    [
      [label('csvBox'), label('csvN')],
      ...flowRows(counts, label),
      [],
      ...(options.workingTranslation ? [[label('workingTranslation')]] : []),
      [label('source')],
      [label('license')],
    ],
    options.delimiter,
  );
}

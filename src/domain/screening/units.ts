import { flowColumn, type FlowColumn } from '../search/sourceTypes';
import type { BibRecord, DuplicateGroup, ImportBatch, Source, SourceRun, UUID } from '../types';

/**
 * What is screened: a duplicate group (shown via its primary record) or a
 * single record. Units are derived, never stored – decisions refer to records.
 */
export interface ScreeningUnit {
  /** Group id or record id; for navigation only. */
  key: UUID;
  primaryId: UUID;
  memberIds: UUID[];
  /** Left (databases, registers, search engines) or right column of the flow diagram. */
  column: FlowColumn;
}

type UnitRecord = Pick<BibRecord, 'id' | 'sourceRunId' | 'importBatchId' | 'sourceLine'>;

export function runColumns(
  sources: readonly Pick<Source, 'id' | 'type'>[],
  runs: readonly Pick<SourceRun, 'id' | 'sourceId'>[],
): Map<UUID, FlowColumn> {
  const typeOf = new Map(sources.map((source) => [source.id, source.type]));
  const columns = new Map<UUID, FlowColumn>();
  for (const run of runs) {
    const type = typeOf.get(run.sourceId);
    if (type) columns.set(run.id, flowColumn(type));
  }
  return columns;
}

/** Stable screening order: import time of the file, then position in the file. */
export function orderRecords<T extends UnitRecord>(
  records: readonly T[],
  batches: readonly Pick<ImportBatch, 'id' | 'importedAt'>[],
): T[] {
  const importedAt = new Map(batches.map((batch) => [batch.id, batch.importedAt]));
  return [...records].sort(
    (a, b) =>
      (importedAt.get(a.importBatchId) ?? '').localeCompare(
        importedAt.get(b.importBatchId) ?? '',
      ) ||
      (a.sourceLine ?? Infinity) - (b.sourceLine ?? Infinity) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Units in the order of their first record. Other methods (PRISMA 2020, right
 * column) skip title/abstract screening – but only if no member comes from a
 * database, register or search engine (decision of 01.10.2026).
 */
export function screeningUnits(
  records: readonly UnitRecord[],
  groups: readonly Pick<DuplicateGroup, 'id' | 'primaryRecordId' | 'memberIds'>[],
  columnOfRun: ReadonlyMap<UUID, FlowColumn>,
): ScreeningUnit[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const groupOf = new Map<UUID, (typeof groups)[number]>();
  for (const group of groups) for (const id of group.memberIds) groupOf.set(id, group);

  const units: ScreeningUnit[] = [];
  const done = new Set<UUID>();
  for (const record of records) {
    const group = groupOf.get(record.id);
    const key = group?.id ?? record.id;
    if (done.has(key)) continue;
    done.add(key);
    const memberIds = group ? group.memberIds.filter((id) => byId.has(id)) : [record.id];
    const column = memberIds.some(
      (id) => columnOfRun.get(byId.get(id)!.sourceRunId) !== 'other_methods',
    )
      ? 'databases_registers'
      : 'other_methods';
    units.push({
      key,
      primaryId: group && byId.has(group.primaryRecordId) ? group.primaryRecordId : memberIds[0]!,
      memberIds,
      column,
    });
  }
  return units;
}

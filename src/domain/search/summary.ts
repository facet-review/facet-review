import type { DateOnly, Source, SourceRun, SourceType } from '../types';
import { SOURCE_TYPE_CONFIG, SOURCE_TYPES, flowColumn, type FlowColumn } from './sourceTypes';

/** Chronological: the first search, then updates. */
export function sortRuns(runs: readonly SourceRun[]): SourceRun[] {
  return [...runs].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Date a source was last searched or consulted (PRISMA 2020 item 6, PRISMA-S item 13). */
export function latestRunDate(runs: readonly SourceRun[]): DateOnly | undefined {
  let latest: DateOnly | undefined;
  for (const run of runs) {
    const end = run.dateTo ?? run.date;
    if (latest === undefined || end > latest) latest = end;
  }
  return latest;
}

export function groupSourcesByType(
  sources: readonly Source[],
): { type: SourceType; sources: Source[] }[] {
  return SOURCE_TYPES.map((type) => ({
    type,
    sources: sources
      .filter((source) => source.type === type)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  })).filter((group) => group.sources.length > 0);
}

export type HitsByColumn = Record<FlowColumn, { hits: number; runsWithoutHits: number }>;

/** Reported hits per flow-diagram column (as reported by the source, before import). */
export function reportedHitsByColumn(
  sources: readonly Source[],
  runs: readonly SourceRun[],
): HitsByColumn {
  const totals: HitsByColumn = {
    databases_registers: { hits: 0, runsWithoutHits: 0 },
    other_methods: { hits: 0, runsWithoutHits: 0 },
  };
  const typeOf = new Map(sources.map((source) => [source.id, source.type]));
  for (const run of runs) {
    const type = typeOf.get(run.sourceId);
    if (!type) continue;
    const column = totals[flowColumn(type)];
    if (run.reportedHits === undefined) column.runsWithoutHits += 1;
    else column.hits += run.reportedHits;
  }
  return totals;
}

/** Display name, e.g. "EBSCOhost (CINAHL, ERIC)" for a multi-database search (PRISMA-S item 2). */
export function sourceLabel(source: Source): string {
  return source.databases && source.databases.length > 0
    ? `${source.name} (${source.databases.join(', ')})`
    : source.name;
}

export type LimitsStatus =
  { kind: 'text'; text: string } | { kind: 'none' } | { kind: 'undocumented' };

/**
 * How a run's limits are reported (PRISMA-S item 9): documented text,
 * explicitly none, or not documented. `undefined` for source types without limits.
 */
export function limitsStatus(type: SourceType, run: SourceRun): LimitsStatus | undefined {
  if (!SOURCE_TYPE_CONFIG[type].runFields.includes('limits')) return undefined;
  if (run.noLimits === true) return { kind: 'none' };
  const text = run.limits?.trim();
  return text ? { kind: 'text', text } : { kind: 'undocumented' };
}

import { SOURCE_TYPES } from '../search/sourceTypes';
import { limitsStatus, sortRuns, sourceLabel, type LimitsStatus } from '../search/summary';
import type {
  CitationDirection,
  DateOnly,
  Project,
  SearchMethod,
  SourceRun,
  SourceType,
} from '../types';
import type { FlowInput } from '../flow/computeFlow';

export interface AppendixRun {
  date: DateOnly;
  dateTo?: DateOnly;
  /** Exactly as executed (PRISMA-S item 8). */
  searchString: string;
  limits?: LimitsStatus;
  reportedHits?: number;
  imported: number;
  importNote?: string;
  tool?: string;
  method?: SearchMethod;
  recordsChecked?: number;
  citationDirection?: CitationDirection;
  seedDocuments?: string;
  description?: string;
  notes?: string;
}

export interface AppendixSource {
  label: string;
  type: SourceType;
  platform?: string;
  url?: string;
  runs: AppendixRun[];
}

export interface SearchAppendix {
  projectTitle: string;
  groups: { type: SourceType; sources: AppendixSource[] }[];
  searchMeta: Project['searchMeta'];
}

/** The search documentation as a document model (PRISMA-S, Rethlefsen et al. 2021). */
export function searchAppendix(
  data: Pick<FlowInput, 'project' | 'sources' | 'sourceRuns' | 'records'>,
): SearchAppendix {
  const imported = new Map<string, number>();
  for (const record of data.records)
    imported.set(record.sourceRunId, (imported.get(record.sourceRunId) ?? 0) + 1);

  const run = (type: SourceType, r: SourceRun): AppendixRun => {
    const limits = limitsStatus(type, r);
    const optional = {
      dateTo: r.dateTo,
      reportedHits: r.reportedHits,
      importNote: r.importNote,
      tool: r.tool,
      method: r.method,
      recordsChecked: r.recordsChecked,
      citationDirection: r.citationDirection,
      seedDocuments: r.seedDocuments,
      description: r.description,
      notes: r.notes,
    };
    return {
      date: r.date,
      searchString: r.searchString,
      ...(limits && { limits }),
      imported: imported.get(r.id) ?? 0,
      ...Object.fromEntries(
        Object.entries(optional).filter(([, v]) => v !== undefined && v !== ''),
      ),
    };
  };

  const groups = SOURCE_TYPES.map((type) => ({
    type,
    sources: data.sources
      .filter((source) => source.type === type)
      .map((source) => ({
        label: sourceLabel(source),
        type,
        ...(source.platform && { platform: source.platform }),
        ...(source.url && { url: source.url }),
        runs: sortRuns(data.sourceRuns.filter((r) => r.sourceId === source.id)).map((r) =>
          run(type, r),
        ),
      }))
      .filter((source) => source.runs.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
  })).filter((group) => group.sources.length > 0);

  return { projectTitle: data.project.title, groups, searchMeta: data.project.searchMeta };
}

export type AppendixLabelKey =
  | 'heading'
  | `type.${SourceType}`
  | 'platform'
  | 'url'
  | 'run'
  | 'date'
  | 'searchString'
  | 'limits'
  | 'noLimits'
  | 'undocumented'
  | 'reportedHits'
  | 'imported'
  | 'importNote'
  | 'tool'
  | 'method'
  | `method.${SearchMethod}`
  | 'recordsChecked'
  | 'citationDirection'
  | `direction.${CitationDirection}`
  | 'seedDocuments'
  | 'description'
  | 'notes'
  | 'projectWide'
  | 'filters'
  | 'priorWork'
  | 'updates'
  | 'peerReview'
  | 'source2021'
  | 'license';
export type AppendixLabels = (key: AppendixLabelKey) => string;

/** A code fence longer than any backtick run inside the text. */
export function codeFence(text: string): string {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

export function limitsText(limits: LimitsStatus, t: AppendixLabels): string {
  if (limits.kind === 'text') return limits.text;
  return limits.kind === 'none' ? t('noLimits') : t('undocumented');
}

/** Markdown version of the appendix: readable as text, search strings in code blocks. */
export function appendixMarkdown(model: SearchAppendix, t: AppendixLabels): string {
  const out: string[] = [`# ${t('heading')}: ${model.projectTitle}`, ''];
  const item = (label: string, value: string | number | undefined) => {
    if (value !== undefined && value !== '') out.push(`- ${label}: ${value}`);
  };
  for (const group of model.groups) {
    out.push(`## ${t(`type.${group.type}`)}`, '');
    for (const source of group.sources) {
      out.push(`### ${source.label}`, '');
      item(t('platform'), source.platform);
      item(t('url'), source.url);
      if (source.platform || source.url) out.push('');
      source.runs.forEach((r, index) => {
        out.push(`#### ${t('run')} ${index + 1}`, '');
        item(t('date'), r.dateTo ? `${r.date} – ${r.dateTo}` : r.date);
        if (r.limits) item(t('limits'), limitsText(r.limits, t));
        item(t('reportedHits'), r.reportedHits);
        item(t('imported'), r.imported);
        item(t('importNote'), r.importNote);
        item(t('tool'), r.tool);
        item(t('method'), r.method && t(`method.${r.method}`));
        item(t('recordsChecked'), r.recordsChecked);
        item(t('citationDirection'), r.citationDirection && t(`direction.${r.citationDirection}`));
        item(t('seedDocuments'), r.seedDocuments);
        item(t('description'), r.description);
        item(t('notes'), r.notes);
        out.push('');
        if (r.searchString) {
          const fence = codeFence(r.searchString);
          out.push(`${t('searchString')}:`, '', fence, r.searchString, fence, '');
        }
      });
    }
  }
  const meta = model.searchMeta;
  const metaItems = (['filters', 'priorWork', 'updates', 'peerReview'] as const).filter(
    (key) => meta[key],
  );
  if (metaItems.length > 0) {
    out.push(`## ${t('projectWide')}`, '');
    for (const key of metaItems) out.push(`- ${t(key)}: ${meta[key]}`);
    out.push('');
  }
  out.push('---', '', t('source2021'), t('license'), '');
  return out.join('\n');
}

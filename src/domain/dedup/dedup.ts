import { firstAuthorKey, normalizeTitle, yearOf } from '../import/normalize';
import type {
  BibRecord,
  DedupDecision,
  DuplicateLink,
  DuplicateRule,
  ISODate,
  UUID,
} from '../types';
import { isErratumTitle, titleSimilarity } from './similarity';

/**
 * Minimum title similarity for a fuzzy candidate. Chosen from the real test exports:
 * all 142 DOI-confirmed duplicates score ≥ 0.99, the most similar non-duplicates ≤ 0.72.
 * Candidates are never merged automatically (see docs/PRD.md, section 4).
 */
export const TITLE_SIMILARITY_THRESHOLD = 0.9;

/** Neighbours compared in the title-sorted list (sorted-neighbourhood blocking). */
const TITLE_WINDOW = 10;

export type DedupRecord = Pick<BibRecord, 'id' | 'csl' | 'doi' | 'pmid'>;

export interface DedupGroupResult {
  primaryRecordId: UUID;
  /** Primary first. */
  memberIds: UUID[];
  rule: DuplicateRule;
  links: DuplicateLink[];
  score?: number;
  confirmedAt?: ISODate;
}

export interface Candidate {
  a: UUID;
  b: UUID;
  score: number;
  reasons: {
    /** undefined if one of the records has no author */
    sameFirstAuthor: boolean | undefined;
    years: [number | undefined, number | undefined];
    /** both have a DOI and they differ – shown as a warning */
    doiConflict: boolean;
  };
}

export interface DedupStats {
  records: number;
  groups: number;
  /** Non-primary members of all groups = "duplicate records removed" (PRISMA 2020). */
  duplicatesRemoved: number;
  unique: number;
  openCandidates: number;
  separatedPairs: number;
}

export interface DedupResult {
  groups: DedupGroupResult[];
  candidates: Candidate[];
  stats: DedupStats;
}

const RULE_STRENGTH: Record<DuplicateRule, number> = {
  doi: 0,
  pmid: 1,
  'title-fuzzy': 2,
  manual: 3,
};

interface Prepared {
  record: DedupRecord;
  index: number;
  title: string;
  author: string | undefined;
  year: number | undefined;
  erratum: boolean;
}

const pairKey = (a: UUID, b: UUID) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Derives duplicate groups and open candidates from records and the user's
 * decisions. Pure and deterministic: the same input always gives the same result.
 *
 * Rules: equal DOI or PMID → merged automatically; similar title (≥ threshold),
 * year ±1 and same first author → candidate only. Decisions (latest per pair)
 * merge, separate or reset pairs and choose primary records.
 */
export function deduplicate(
  records: readonly DedupRecord[],
  decisions: readonly DedupDecision[],
): DedupResult {
  const prepared: Prepared[] = records.map((record, index) => {
    const title = normalizeTitle(record.csl.title);
    return {
      record,
      index,
      title,
      author: firstAuthorKey(record.csl),
      year: yearOf(record.csl),
      erratum: isErratumTitle(title),
    };
  });
  const byId = new Map(prepared.map((p) => [p.record.id, p]));

  // Latest decision per pair (or per record for "primary").
  const pairDecisions = new Map<string, DedupDecision>();
  const primaryChoice = new Map<UUID, string>();
  const ordered = [...decisions].sort((x, y) => x.timestamp.localeCompare(y.timestamp));
  for (const decision of ordered) {
    if (!decision.recordIds.every((id) => byId.has(id))) continue;
    if (decision.value === 'primary') {
      const [id] = decision.recordIds;
      if (id) primaryChoice.set(id, decision.timestamp);
      continue;
    }
    const [a, b] = decision.recordIds;
    if (!a || !b) continue;
    if (decision.value === 'reset') pairDecisions.delete(pairKey(a, b));
    else pairDecisions.set(pairKey(a, b), decision);
  }
  const separated = new Set(
    [...pairDecisions].filter(([, d]) => d.value === 'separate').map(([key]) => key),
  );

  // Links: automatic identifier matches plus confirmed merges.
  const links: DuplicateLink[] = [];
  const linked = new Set<string>();
  const addLink = (link: DuplicateLink) => {
    const key = pairKey(link.a, link.b);
    if (linked.has(key) || separated.has(key)) return;
    linked.add(key);
    links.push(link);
  };
  for (const [field, rule] of [
    ['doi', 'doi'],
    ['pmid', 'pmid'],
  ] as const) {
    const byValue = new Map<string, Prepared[]>();
    for (const p of prepared) {
      const value = p.record[field];
      if (value) byValue.set(value, [...(byValue.get(value) ?? []), p]);
    }
    for (const members of byValue.values()) {
      for (let i = 0; i < members.length; i++)
        for (let j = i + 1; j < members.length; j++)
          addLink({ a: members[i]!.record.id, b: members[j]!.record.id, rule });
    }
  }
  const mergeTimes = new Map<string, ISODate>();
  for (const [key, decision] of pairDecisions) {
    if (decision.value !== 'merge') continue;
    const [x, y] = decision.recordIds.map((id) => byId.get(id)!);
    const [a, b] = x!.record.id < y!.record.id ? [x!, y!] : [y!, x!];
    const fuzzy = compare(a, b);
    addLink(
      fuzzy
        ? { a: a.record.id, b: b.record.id, rule: 'title-fuzzy', score: fuzzy.score }
        : { a: a.record.id, b: b.record.id, rule: 'manual' },
    );
    mergeTimes.set(key, decision.timestamp);
  }

  // Connected components (union–find).
  const parent = new Map(prepared.map((p) => [p.record.id, p.record.id]));
  const find = (id: UUID): UUID => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const link of links) parent.set(find(link.a), find(link.b));
  const components = new Map<UUID, Prepared[]>();
  for (const p of prepared) {
    const root = find(p.record.id);
    components.set(root, [...(components.get(root) ?? []), p]);
  }

  const groups: DedupGroupResult[] = [];
  const representatives: Prepared[] = [];
  const componentOf = new Map<UUID, Prepared[]>();
  for (const members of components.values()) {
    const primary = choosePrimary(members, primaryChoice);
    representatives.push(primary);
    for (const member of members) componentOf.set(member.record.id, members);
    if (members.length < 2) continue;
    const ids = new Set(members.map((m) => m.record.id));
    const groupLinks = links.filter((link) => ids.has(link.a));
    const scores = groupLinks.map((link) => link.score).filter((s): s is number => s !== undefined);
    const confirmed = groupLinks
      .map((link) => mergeTimes.get(pairKey(link.a, link.b)))
      .filter((time): time is ISODate => time !== undefined)
      .sort();
    const group: DedupGroupResult = {
      primaryRecordId: primary.record.id,
      memberIds: [
        primary.record.id,
        ...members
          .filter((m) => m !== primary)
          .sort((x, y) => x.index - y.index)
          .map((m) => m.record.id),
      ],
      rule: groupLinks.reduce<DuplicateRule>(
        (best, link) => (RULE_STRENGTH[link.rule] < RULE_STRENGTH[best] ? link.rule : best),
        'manual',
      ),
      links: groupLinks,
    };
    if (scores.length > 0) group.score = Math.max(...scores);
    if (confirmed.length > 0) group.confirmedAt = confirmed.at(-1)!;
    groups.push(group);
  }
  groups.sort((x, y) => byId.get(x.primaryRecordId)!.index - byId.get(y.primaryRecordId)!.index);

  const candidates = findCandidates(representatives, componentOf, separated);
  const duplicatesRemoved = groups.reduce((sum, group) => sum + group.memberIds.length - 1, 0);
  return {
    groups,
    candidates,
    stats: {
      records: records.length,
      groups: groups.length,
      duplicatesRemoved,
      unique: records.length - duplicatesRemoved,
      openCandidates: candidates.length,
      separatedPairs: separated.size,
    },
  };
}

/** Fuzzy comparison; undefined if the pair is no candidate. */
function compare(a: Prepared, b: Prepared): Omit<Candidate, 'a' | 'b'> | undefined {
  if (!a.title || !b.title || a.erratum !== b.erratum) return undefined;
  if (a.year !== undefined && b.year !== undefined && Math.abs(a.year - b.year) > 1)
    return undefined;
  if (a.author && b.author && a.author !== b.author) return undefined;
  const score = titleSimilarity(a.title, b.title, TITLE_SIMILARITY_THRESHOLD);
  if (score < TITLE_SIMILARITY_THRESHOLD) return undefined;
  const doiA = a.record.doi;
  const doiB = b.record.doi;
  return {
    score,
    reasons: {
      sameFirstAuthor: a.author && b.author ? true : undefined,
      years: [a.year, b.year],
      doiConflict: !!doiA && !!doiB && doiA !== doiB,
    },
  };
}

/**
 * Candidate pairs among group representatives. Blocking: same first author,
 * or neighbours in the title-sorted list – avoids comparing all pairs.
 */
function findCandidates(
  representatives: Prepared[],
  componentOf: Map<UUID, Prepared[]>,
  separated: Set<string>,
): Candidate[] {
  const pairs = new Set<string>();
  const consider = (x: Prepared, y: Prepared) => pairs.add(pairKey(x.record.id, y.record.id));

  const byAuthor = new Map<string, Prepared[]>();
  for (const p of representatives) {
    if (p.author) byAuthor.set(p.author, [...(byAuthor.get(p.author) ?? []), p]);
  }
  for (const bucket of byAuthor.values())
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) consider(bucket[i]!, bucket[j]!);

  const sorted = representatives
    .filter((p) => p.title)
    .sort((x, y) => x.title.localeCompare(y.title));
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j <= i + TITLE_WINDOW && j < sorted.length; j++)
      consider(sorted[i]!, sorted[j]!);

  const byRecord = new Map(representatives.map((p) => [p.record.id, p]));
  const candidates: Candidate[] = [];
  for (const key of pairs) {
    const [idA = '', idB = ''] = key.split('|');
    const a = byRecord.get(idA)!;
    const b = byRecord.get(idB)!;
    if (isSeparated(componentOf.get(idA)!, componentOf.get(idB)!, separated)) continue;
    const result = compare(a, b);
    if (result) candidates.push({ a: idA, b: idB, ...result });
  }
  return candidates.sort(
    (x, y) => y.score - x.score || x.a.localeCompare(y.a) || x.b.localeCompare(y.b),
  );
}

function isSeparated(groupA: Prepared[], groupB: Prepared[], separated: Set<string>): boolean {
  return groupA.some((x) => groupB.some((y) => separated.has(pairKey(x.record.id, y.record.id))));
}

/** User choice first; otherwise the most complete record (DOI > PMID > abstract > authors > year > journal). */
function choosePrimary(members: Prepared[], primaryChoice: Map<UUID, string>): Prepared {
  const chosen = members
    .filter((m) => primaryChoice.has(m.record.id))
    .sort((x, y) => primaryChoice.get(y.record.id)!.localeCompare(primaryChoice.get(x.record.id)!));
  if (chosen[0]) return chosen[0];
  const completeness = ({ record }: Prepared) =>
    (record.doi ? 32 : 0) +
    (record.pmid ? 16 : 0) +
    (record.csl.abstract ? 8 : 0) +
    (record.csl.author?.length ? 4 : 0) +
    (record.csl.issued ? 2 : 0) +
    (record.csl['container-title'] ? 1 : 0);
  return [...members].sort(
    (x, y) => completeness(y) - completeness(x) || x.record.id.localeCompare(y.record.id),
  )[0]!;
}

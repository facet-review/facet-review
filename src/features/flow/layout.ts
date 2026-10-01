import { drawnReasons } from '../../domain/flow/computeFlow';
import { nText, type FlowLabels } from '../../domain/flow/labels';
import type { Count, FlowCounts, Retrieval } from '../../domain/flow/types';
import { hasOtherMethods, isUpdateVariant } from '../../domain/flow/variant';

/**
 * Geometry of the PRISMA 2020 flow diagram, close to the four templates
 * (Page et al. 2021). Pure and deterministic: text is wrapped with a fixed
 * average character width instead of DOM measuring, so screen, export and
 * tests produce the same picture.
 */

export const FONT_SIZE = 12;
const LINE_HEIGHT = 16;
const CHAR_WIDTH = FONT_SIZE * 0.56;
const PAD = 10;
const BOX_W = 230;
const SIDE_GAP = 44;
const SECTION_GAP = 36;
const PHASE_W = 26;
const PHASE_GAP = 14;
const HEADER_H = 40;
const ROW_GAP = 34;
const MARGIN = 16;

export interface Line {
  text: string;
  bold?: boolean;
  indent?: number;
}

/** What a box leads to in the drill-down (one entry per number in the box). */
export interface Target {
  key: string;
  label: string;
  count: Count;
}

export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: Line[];
  targets: Target[];
  /** Spoken name: all lines of the box. */
  label: string;
  /** Manually entered numbers (update reviews) are marked. */
  manual?: boolean;
}

export interface Header {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
}

export interface Phase {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FlowLayout {
  width: number;
  height: number;
  headers: Header[];
  phases: Phase[];
  boxes: Box[];
  arrows: [number, number][][];
  footer: { x: number; y: number; lines: string[] };
}

/** Greedy word wrap with a fixed character width; long words are split. */
export function wrap(text: string, width: number): string[] {
  const max = Math.max(4, Math.floor(width / CHAR_WIDTH));
  const lines: string[] = [];
  let line = '';
  // Only ordinary spaces break; no-break spaces (e.g. in "(n = 3)") hold together.
  for (const word of text.split(/[ \t\n]+/).filter(Boolean)) {
    let rest = word;
    while (rest.length > max) {
      if (line) lines.push(line);
      lines.push(rest.slice(0, max));
      line = '';
      rest = rest.slice(max);
    }
    if (!line) line = rest;
    else if (line.length + 1 + rest.length <= max) line += ` ${rest}`;
    else {
      lines.push(line);
      line = rest;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface Content {
  id: string;
  lines: Line[];
  targets: Target[];
  manual?: boolean;
}

function wrapLines(lines: Line[], width: number): Line[] {
  return lines.flatMap((line) => {
    const indent = (line.indent ?? 0) * 12;
    return wrap(line.text, width - 2 * PAD - indent).map((text) => ({ ...line, text }));
  });
}

const boxHeight = (lines: Line[]) => lines.length * LINE_HEIGHT + 2 * PAD;

export function flowLayout(
  counts: FlowCounts,
  label: FlowLabels,
  options: { workingTranslation: boolean },
): FlowLayout {
  const update = isUpdateVariant(counts.variant);
  const other = hasOtherMethods(counts.variant);
  const db = counts.databases;
  const target = (key: string, text: string, count: Count): Target => ({ key, label: text, count });
  const item = (text: string, n: number | undefined, indent = 1): Line => ({
    text: `${text} ${nText(n)}`,
    indent,
  });

  // --- contents ------------------------------------------------------------
  const identified: Content = {
    id: 'db.identified',
    lines: [
      { text: label('identifiedFrom'), bold: true },
      item(label('databases'), sum(db.databases)),
      ...db.databases.map((s) => item(s.label, s.n, 2)),
      item(label('registers'), sum(db.registers)),
      ...db.registers.map((s) => item(s.label, s.n, 2)),
    ],
    targets: [
      target('db.databases', label('databases'), merge(db.databases)),
      ...db.databases.map((s) =>
        target(`db.source.${s.sourceId}`, `${label('databases')}: ${s.label}`, s),
      ),
      ...db.registers.map((s) =>
        target(`db.source.${s.sourceId}`, `${label('registers')}: ${s.label}`, s),
      ),
      target('db.registers', label('registers'), merge(db.registers)),
    ],
  };
  const removed: Content = {
    id: 'db.removed',
    lines: [
      { text: label('removedBefore'), bold: true },
      item(label('duplicates'), db.duplicates.n),
      item(label('automation'), db.removedAutomation.n),
      item(label('removedOther'), db.removedOther.n),
    ],
    targets: [
      target('db.duplicates', label('duplicates'), db.duplicates),
      target('db.automation', label('automation'), db.removedAutomation),
      target('db.removedOther', label('removedOther'), db.removedOther),
    ],
  };
  const single = (id: string, key: Parameters<FlowLabels>[0], count: Count): Content => ({
    id,
    lines: [{ text: label(key), bold: true }, { text: nText(count.n) }],
    targets: [target(id, label(key), count)],
  });
  const reasons = (prefix: string, column: Retrieval): Content => ({
    id: `${prefix}.reportsExcluded`,
    lines: [
      { text: label('reportsExcluded'), bold: true },
      ...drawnReasons(column.reportsExcluded).map((r) => item(r.label, r.n)),
      ...(column.reportsExcludedTotal.n === 0 ? [{ text: nText(0), indent: 1 }] : []),
    ],
    targets: drawnReasons(column.reportsExcluded).map((r) =>
      target(`${prefix}.reason.${r.reasonId}`, `${label('reportsExcluded')} ${r.label}`, r),
    ),
  });
  const pair = (
    id: string,
    a: Parameters<FlowLabels>[0],
    an: number | undefined,
    b: Parameters<FlowLabels>[0],
    bn: number | undefined,
    targets: Target[],
    manual = false,
  ): Content => ({
    id,
    lines: [
      { text: `${label(a)} ${nText(an)}${manual ? ` ${label('manual')}` : ''}`, bold: true },
      { text: `${label(b)} ${nText(bn)}${manual ? ` ${label('manual')}` : ''}`, bold: true },
    ],
    targets,
    manual,
  });

  const studiesTargets = [
    target('studies', label(update ? 'newStudies' : 'studies'), counts.studies),
    target('reports', label(update ? 'newReports' : 'reports'), counts.reports),
  ];
  const included = update
    ? pair(
        'included',
        'newStudies',
        counts.studies.n,
        'newReports',
        counts.reports.n,
        studiesTargets,
      )
    : pair('included', 'studies', counts.studies.n, 'reports', counts.reports.n, studiesTargets);
  const previous = counts.previous ?? {};
  const add = (a: number | undefined, b: number) => (a === undefined ? undefined : a + b);
  const previousBox = pair(
    'previous',
    'previousStudies',
    previous.studies,
    'previousReports',
    previous.reports,
    [],
    true,
  );
  const totalBox = pair(
    'total',
    'totalStudies',
    add(previous.studies, counts.studies.n),
    'totalReports',
    add(previous.reports, counts.reports.n),
    [],
  );

  const otherIdentified: Content = {
    id: 'other.identified',
    lines: [
      { text: label('identifiedFromOther'), bold: true },
      ...counts.other.methods.map((m) => item(label(m.method), m.n)),
      ...(counts.other.inDatabaseUnits.n > 0
        ? [
            {
              text: `${label('otherInDatabaseUnits')} ${nText(counts.other.inDatabaseUnits.n)}`,
              indent: 1,
            },
          ]
        : []),
      ...(counts.other.duplicatesWithin.n > 0
        ? [
            {
              text: `${label('otherDuplicatesWithin')} ${nText(counts.other.duplicatesWithin.n)}`,
              indent: 1,
            },
          ]
        : []),
    ],
    targets: [
      ...counts.other.sources.map((s) => target(`other.source.${s.sourceId}`, s.label, s)),
      ...(counts.other.inDatabaseUnits.n > 0
        ? [
            target(
              'other.inDatabaseUnits',
              label('otherInDatabaseUnits'),
              counts.other.inDatabaseUnits,
            ),
          ]
        : []),
    ],
  };

  // --- grid ----------------------------------------------------------------
  const x0 = MARGIN + PHASE_W + PHASE_GAP;
  const sectionWidth = BOX_W * 2 + SIDE_GAP;
  const prevX = x0;
  const dbX = update ? prevX + BOX_W + SECTION_GAP : x0;
  const otherX = dbX + sectionWidth + SECTION_GAP;
  const width = (other ? otherX + sectionWidth : dbX + sectionWidth) + MARGIN;

  const headers: Header[] = [];
  const header = (x: number, w: number, key: Parameters<FlowLabels>[0]) =>
    headers.push({ x, y: MARGIN, w, h: HEADER_H, lines: wrap(label(key), w - 2 * PAD) });
  if (update) header(prevX, BOX_W, 'headerPrevious');
  header(dbX, sectionWidth, update ? 'headerNewDatabases' : 'headerDatabases');
  if (other) header(otherX, sectionWidth, update ? 'headerNewOther' : 'headerOther');

  // Rows: identification, screened, sought, assessed, included (+ total).
  const rows: (Content | undefined)[][] = [
    [update ? previousBox : undefined, identified, removed, other ? otherIdentified : undefined],
    [
      undefined,
      single('db.screened', 'screened', db.screened),
      single('db.excluded', 'excluded', db.excluded),
    ],
    [
      undefined,
      single('db.sought', 'sought', db.sought),
      single('db.notRetrieved', 'notRetrieved', db.notRetrieved),
      other ? single('other.sought', 'sought', counts.other.sought) : undefined,
      other ? single('other.notRetrieved', 'notRetrieved', counts.other.notRetrieved) : undefined,
    ],
    [
      undefined,
      single('db.assessed', 'assessed', db.assessed),
      reasons('db', db),
      other ? single('other.assessed', 'assessed', counts.other.assessed) : undefined,
      other ? reasons('other', counts.other) : undefined,
    ],
    [undefined, included],
    ...(update ? [[undefined, totalBox]] : []),
  ];
  // Column positions: previous, db main, db side, other main, other side.
  const columnX = [prevX, dbX, dbX + BOX_W + SIDE_GAP, otherX, otherX + BOX_W + SIDE_GAP];
  // In the identification row the other-methods box sits in its main column.
  const rowColumns = (row: number, index: number) => (row === 0 && index === 3 ? 3 : index);

  const boxes: Box[] = [];
  const rowTop: number[] = [];
  const rowHeight: number[] = [];
  let y = MARGIN + HEADER_H + 18;
  rows.forEach((row, r) => {
    const wrapped = row.map(
      (content) => content && { ...content, lines: wrapLines(content.lines, BOX_W) },
    );
    const height = Math.max(...wrapped.map((c) => (c ? boxHeight(c.lines) : 0)));
    rowTop.push(y);
    rowHeight.push(height);
    wrapped.forEach((content, index) => {
      if (!content) return;
      boxes.push({
        id: content.id,
        x: columnX[rowColumns(r, index)]!,
        y,
        w: BOX_W,
        h: boxHeight(content.lines),
        lines: content.lines,
        targets: content.targets,
        label: content.lines.map((line) => line.text).join(' '),
        ...(content.manual && { manual: true }),
      });
    });
    y += height + ROW_GAP;
  });
  const contentBottom = y - ROW_GAP;

  // --- arrows (orthogonal, ending in an arrowhead) ---------------------------
  const box = (id: string) => boxes.find((b) => b.id === id)!;
  const down = (from: string, to: string): [number, number][] => {
    const a = box(from);
    const b = box(to);
    const x = a.x + a.w / 2;
    return [
      [x, a.y + a.h],
      [x, b.y],
    ];
  };
  const right = (from: string, to: string): [number, number][] => {
    const a = box(from);
    const b = box(to);
    const yMid = a.y + Math.min(a.h, b.h) / 2;
    return [
      [a.x + a.w, yMid],
      [b.x, yMid],
    ];
  };
  const arrows: [number, number][][] = [
    down('db.identified', 'db.screened'),
    right('db.identified', 'db.removed'),
    right('db.screened', 'db.excluded'),
    down('db.screened', 'db.sought'),
    right('db.sought', 'db.notRetrieved'),
    down('db.sought', 'db.assessed'),
    right('db.assessed', 'db.reportsExcluded'),
    down('db.assessed', 'included'),
  ];
  if (other) {
    arrows.push(
      down('other.identified', 'other.sought'),
      right('other.sought', 'other.notRetrieved'),
      down('other.sought', 'other.assessed'),
      right('other.assessed', 'other.reportsExcluded'),
    );
    const a = box('other.assessed');
    const inc = box('included');
    const yIn = inc.y + inc.h / 2;
    arrows.push([
      [a.x + a.w / 2, a.y + a.h],
      [a.x + a.w / 2, yIn],
      [inc.x + inc.w, yIn],
    ]);
  }
  if (update) {
    arrows.push(down('included', 'total'));
    const p = box('previous');
    const total = box('total');
    const yIn = total.y + total.h / 2;
    arrows.push([
      [p.x + p.w / 2, p.y + p.h],
      [p.x + p.w / 2, yIn],
      [total.x, yIn],
    ]);
  }

  // --- phases (Identification / Screening / Included) ------------------------
  const span = (from: number, to: number) => ({
    y: rowTop[from]!,
    h: rowTop[to]! + rowHeight[to]! - rowTop[from]!,
  });
  const lastRow = rows.length - 1;
  const phases: Phase[] = [
    { label: label('phaseIdentification'), x: MARGIN, w: PHASE_W, ...span(0, 0) },
    { label: label('phaseScreening'), x: MARGIN, w: PHASE_W, ...span(1, 3) },
    { label: label('phaseIncluded'), x: MARGIN, w: PHASE_W, ...span(4, lastRow) },
  ];

  const footerLines = [
    ...(options.workingTranslation ? [label('workingTranslation')] : []),
    label('source'),
    label('license'),
  ];
  const footerY = contentBottom + 28;
  return {
    width,
    height: footerY + footerLines.length * LINE_HEIGHT + MARGIN,
    headers,
    phases,
    boxes,
    arrows,
    footer: { x: MARGIN, y: footerY, lines: footerLines },
  };
}

function merge(items: readonly Count[]): Count {
  const recordIds = items.flatMap((c) => c.recordIds);
  return { n: recordIds.length, recordIds };
}

function sum(items: readonly Count[]) {
  return items.reduce((total, c) => total + c.n, 0);
}

export const LAYOUT = { LINE_HEIGHT, PAD, FONT_SIZE };

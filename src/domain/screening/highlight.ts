export type HighlightKind = 'include' | 'exclude';
export interface Segment {
  text: string;
  mark?: HighlightKind;
}

/**
 * Folds a text for matching (lower case, no diacritics, compatibility forms)
 * and remembers for every folded character where it came from.
 */
function fold(text: string): { folded: string; origin: number[] } {
  let folded = '';
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    const part = char.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
    for (let i = 0; i < part.length; i++) origin.push(index);
    folded += part;
    index += char.length;
  }
  origin.push(index);
  return { folded, origin };
}

const WORD = '[\\p{L}\\p{N}]';

function termPattern(term: string): string | undefined {
  const cleaned = fold(term.replace(/^["']+|["']+$/g, '').trim()).folded;
  if (!cleaned.replace(/\*/g, '')) return undefined;
  const truncated = cleaned.endsWith('*');
  const body = cleaned
    .replace(/\*+$/, '')
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  return `(?<!${WORD})${body}${truncated ? `${WORD}*` : `(?!${WORD})`}`;
}

/**
 * Splits a text into segments for highlighting search terms (PRD Modul 4).
 * Case and diacritics are ignored, `*` truncates, phrases match across line
 * breaks. Overlaps resolve to the longer match; the text is never altered.
 */
export function highlightSegments(
  text: string,
  terms: { include: readonly string[]; exclude: readonly string[] },
): Segment[] {
  const { folded, origin } = fold(text);
  const matches: { start: number; end: number; mark: HighlightKind }[] = [];
  for (const mark of ['include', 'exclude'] as const) {
    for (const term of terms[mark]) {
      const pattern = termPattern(term);
      if (!pattern) continue;
      for (const match of folded.matchAll(new RegExp(pattern, 'gu'))) {
        const start = origin[match.index]!;
        const end = origin[match.index + match[0].length]!;
        if (end > start) matches.push({ start, end, mark });
      }
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: Segment[] = [];
  let position = 0;
  for (const match of matches) {
    if (match.start < position) continue;
    if (match.start > position) segments.push({ text: text.slice(position, match.start) });
    segments.push({ text: text.slice(match.start, match.end), mark: match.mark });
    position = match.end;
  }
  if (position < text.length || segments.length === 0)
    segments.push({ text: text.slice(position) });
  return segments;
}

/** Terms as typed in the settings: separated by line breaks or commas. */
export function parseTerms(input: string): string[] {
  const terms = input
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean);
  return [...new Set(terms)];
}

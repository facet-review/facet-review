/**
 * Levenshtein distance computed only within a band of width 2·max+1.
 * Returns max + 1 as soon as the distance must exceed max.
 */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const over = max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => (j <= max ? j : over));
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(over);
    current[0] = i <= max ? i : over;
    let rowMin = current[0];
    const from = Math.max(1, i - max);
    const to = Math.min(b.length, i + max);
    for (let j = from; j <= to; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current[j] = Math.min(value, over);
      if (current[j]! < rowMin) rowMin = current[j]!;
    }
    if (rowMin > max) return over;
    previous = current;
  }
  return Math.min(previous[b.length]!, over);
}

/**
 * Similarity of two normalised titles: 1 − distance / longer length.
 * Below the threshold the exact value is irrelevant and 0 is returned (fast path).
 */
export function titleSimilarity(a: string, b: string, threshold: number): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const longer = Math.max(a.length, b.length);
  const maxDistance = Math.floor((1 - threshold) * longer + 1e-9);
  const distance = boundedLevenshtein(a, b, maxDistance);
  return distance > maxDistance ? 0 : 1 - distance / longer;
}

const ERRATUM =
  /^(?:correction to|correction|erratum|corrigendum|retraction note|retraction|retracted|notice of retraction|expression of concern|author correction|publisher correction|reply to|response to|comment on)\b/;

/** Corrections, retractions and replies refer to an article but are not duplicates of it. */
export function isErratumTitle(normalizedTitle: string): boolean {
  return ERRATUM.test(normalizedTitle);
}

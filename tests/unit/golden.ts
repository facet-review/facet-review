import { Session } from './session';

/**
 * tests/fixtures/flow/golden-scenario.md played through: the reference
 * project for flow counts, checklist suggestions and exports.
 */
const REASONS = ['Falsche Population', 'Falsches Studiendesign', 'Falsche Sprache'];
const TA = 'title_abstract' as const;
const FT = 'full_text' as const;

export interface GoldenOptions {
  /** §6 case 1: leave out the full-text decision for D2. */
  skipD2FullText?: boolean;
  /** §6 case 2: undo the C merge afterwards. */
  splitC?: boolean;
}

export function playGoldenScenario(options: GoldenOptions = {}) {
  // §1 Setup: three databases, three exclusion reasons in this order.
  const session = new Session(REASONS);
  session.importFile('synthetic/edge-cases.ris', 'ris', session.addSource('Synthetic Scopus'));
  session.importFile('synthetic/edge-cases.nbib', 'nbib', session.addSource('Synthetic PubMed'));
  session.importFile('synthetic/edge-cases.csv', 'csv', session.addSource('Synthetic CSV-DB'));

  // §2 Deduplication: A, B, K automatic; C confirmed; D1/D2 rejected.
  session.dedupDecision('merge', 'C1', 'C2');
  session.dedupDecision('separate', 'D1', 'D2');

  // §3 Title/abstract screening, incl. H1: include, undo (Z), exclude.
  for (const id of ['A1', 'B-ris', 'K1', 'C1', 'D1', 'D2', 'E1'])
    session.decide(id, { stage: TA, value: 'include' });
  for (const id of ['F1', 'F2', 'G1']) session.decide(id, { stage: TA, value: 'exclude' });
  session.decide('H1', { stage: TA, value: 'include' });
  session.undo(TA);
  session.decide('H1', { stage: TA, value: 'exclude' });
  session.decide('L1', { stage: TA, value: 'exclude' });

  // §4 Full-text screening and report → study.
  const reason = (label: string) => ({ reasonId: session.reasonId(label) });
  session.decide('E1', { stage: FT, value: 'not_retrieved' });
  session.decide('A1', { stage: FT, value: 'exclude', ...reason('Falsches Studiendesign') });
  session.decide('D1', { stage: FT, value: 'exclude', ...reason('Falsches Studiendesign') });
  session.decide('C1', { stage: FT, value: 'exclude', ...reason('Falsche Sprache') });
  const study1 = session.addStudy('Studie 1');
  session.decide('B-ris', { stage: FT, value: 'include', studyId: study1 });
  session.decide('K1', { stage: FT, value: 'include', studyId: study1 });
  if (!options.skipD2FullText) {
    const study2 = session.addStudy('Studie 2');
    session.decide('D2', { stage: FT, value: 'include', studyId: study2 });
  }

  if (options.splitC) session.dedupDecision('separate', 'C1', 'C2');
  return session;
}

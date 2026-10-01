/**
 * Texts of the flow diagram (template: Page et al. 2021, CC BY 4.0). The
 * strings live in the i18n files under `flow.diagram.*`; domain code only
 * knows the keys, so diagram and CSV can be produced in either language.
 */
export const FLOW_LABEL_KEYS = [
  'headerDatabases',
  'headerOther',
  'headerNewDatabases',
  'headerNewOther',
  'headerPrevious',
  'phaseIdentification',
  'phaseScreening',
  'phaseIncluded',
  'identifiedFrom',
  'databases',
  'registers',
  'identifiedFromOther',
  'websites',
  'organisations',
  'citations',
  'other',
  'removedBefore',
  'duplicates',
  'automation',
  'removedOther',
  'screened',
  'excluded',
  'sought',
  'notRetrieved',
  'assessed',
  'reportsExcluded',
  'studies',
  'reports',
  'previousStudies',
  'previousReports',
  'newStudies',
  'newReports',
  'totalStudies',
  'totalReports',
  'manual',
  'source',
  'license',
  'workingTranslation',
  'csvBox',
  'csvN',
  'otherInDatabaseUnits',
  'otherDuplicatesWithin',
] as const;

export type FlowLabelKey = (typeof FLOW_LABEL_KEYS)[number];
export type FlowLabels = (key: FlowLabelKey) => string;

/** "(n = 12)" – the number format of the template; no-break spaces keep it on one line. */
export const nText = (n: number | undefined) => `(n\u00A0=\u00A0${n ?? '–'})`;

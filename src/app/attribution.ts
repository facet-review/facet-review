/**
 * Mandatory attribution for the PRISMA 2020 templates (CC BY 4.0) and PRISMA-S.
 * Bibliographic references are not translated; they must appear in the app and in every export.
 */
export interface Citation {
  id: string;
  text: string;
  doi: string;
}

export const PRISMA_CITATIONS: readonly Citation[] = [
  {
    id: 'prisma2020',
    text: 'Page MJ, et al. The PRISMA 2020 statement. BMJ 2021;372:n71.',
    doi: '10.1136/bmj.n71',
  },
  {
    id: 'prisma-s',
    text: 'Rethlefsen ML, et al. PRISMA-S. Syst Rev 2021;10:39.',
    doi: '10.1186/s13643-020-01542-z',
  },
];

export const CC_BY_4_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const AUTHOR = { name: 'Günther Hochhauser', url: 'https://ghochhauser.at' } as const;
export const SOURCE_CODE_URL = 'https://github.com/facet-review/facet-review';

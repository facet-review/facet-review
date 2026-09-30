import type { Project, QuestionFramework } from '../types';

/** Components of each question framework, in display order. */
export const FRAMEWORK_FIELDS: Record<QuestionFramework, readonly string[]> = {
  PICO: ['population', 'intervention', 'comparison', 'outcome'],
  PICo: ['population', 'phenomenon', 'context'],
  SPIDER: ['sample', 'phenomenon', 'design', 'evaluation', 'researchType'],
  free: [],
};

export const FRAMEWORKS = Object.keys(FRAMEWORK_FIELDS) as QuestionFramework[];

type Question = Project['question'];

/**
 * Switches the framework, keeping values of fields that exist in both.
 * `discarded` lists non-empty values that would be lost, so the UI can ask first.
 */
export function switchFramework(
  question: Question,
  framework: QuestionFramework,
): { question: Question; discarded: string[] } {
  const keys = FRAMEWORK_FIELDS[framework];
  const fields = Object.fromEntries(keys.map((key) => [key, question.fields[key] ?? '']));
  const discarded = Object.entries(question.fields)
    .filter(([key, value]) => !keys.includes(key) && value.trim() !== '')
    .map(([key]) => key);
  return { question: { ...question, framework, fields }, discarded };
}

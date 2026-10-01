import { useMemo } from 'react';
import { highlightSegments } from '../../domain/screening/highlight';
import type { ScreeningSettings } from '../../domain/types';
import styles from './Screening.module.css';

interface Props {
  text: string;
  terms: ScreeningSettings['highlights'];
  enabled: boolean;
}

/** Search terms marked in the text; not by colour alone (WCAG 1.4.1) – see legend. */
export function Highlighted({ text, terms, enabled }: Props) {
  const segments = useMemo(
    () => (enabled ? highlightSegments(text, terms) : [{ text }]),
    [text, terms, enabled],
  );
  return (
    <>
      {segments.map((segment, index) =>
        segment.mark ? (
          <mark key={index} className={styles[segment.mark]}>
            {segment.text}
          </mark>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import button from '../../design/button.module.css';
import { ToggleGroup } from '../../design/ToggleGroup';
import { checklistDocument } from '../../domain/checklist/document';
import {
  CHECKLIST_SOURCE,
  TRANSLATION_NOTICE_DE,
  type ItemLanguage,
} from '../../domain/checklist/items';
import type { ChecklistEntry } from '../../domain/types';
import i18n, { LANGUAGE_ENDONYMS } from '../../i18n';
import { download } from '../flow/exportFlow';
import { exportFileName } from '../export/files';
import { checklistPdf } from '../export/pdf';
import styles from './Checklist.module.css';

const LANGUAGES = (['en', 'de'] as const).map((value) => ({
  value,
  label: LANGUAGE_ENDONYMS[value],
  lang: value,
}));

/** PDF in the layout of the official checklist; English (original) by default. */
export function ChecklistPdfButton({
  entries,
  projectTitle,
  onDone,
}: {
  entries: readonly ChecklistEntry[];
  projectTitle: string;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<ItemLanguage>('en');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const fixed = i18n.getFixedT(language);
      const blob = await checklistPdf({
        title: fixed('checklist.pdf.title'),
        subtitle: projectTitle,
        columns: [
          fixed('checklist.pdf.columnTopic'),
          fixed('checklist.pdf.columnItem'),
          fixed('checklist.pdf.columnText'),
          fixed('checklist.pdf.columnLocation'),
        ],
        sections: checklistDocument(entries, language, fixed('checklist.pdf.notApplicable')),
        ...(language === 'de' && { notice: TRANSLATION_NOTICE_DE }),
        footer: [
          `${fixed('checklist.pdf.from')} ${CHECKLIST_SOURCE}`,
          fixed('checklist.pdf.license'),
        ],
        language,
        pageLabel: (page, total) => fixed('checklist.pdf.page', { page, total }),
      });
      download(blob, exportFileName('checklist', 'pdf'), 'application/pdf');
      onDone(t('export.done', { file: 'PDF' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.pdf}>
      <ToggleGroup
        label={t('checklist.pdfLanguage')}
        options={LANGUAGES}
        value={language}
        onChange={setLanguage}
      />
      <button
        type="button"
        className={button.button}
        aria-disabled={busy || undefined}
        onClick={busy ? undefined : () => void run()}
      >
        {busy ? t('export.working') : t('checklist.exportPdf')}
      </button>
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeading } from '../../app/PageHeading';
import { nowIso } from '../../app/runtime';
import { listChecklist, saveChecklistEntry } from '../../db/checklistRepository';
import { db } from '../../db/db';
import { listScreeningData } from '../../db/screeningRepository';
import button from '../../design/button.module.css';
import { ConfirmDialog } from '../../design/ConfirmDialog';
import { TextField } from '../../design/Field';
import forms from '../../design/forms.module.css';
import notice from '../../design/notice.module.css';
import { ToggleGroup } from '../../design/ToggleGroup';
import { adoptSuggestion, checklistProgress, type Suggestion } from '../../domain/checklist/adopt';
import {
  CHECKLIST_ITEMS,
  CHECKLIST_SOURCE,
  TRANSLATION_NOTICE_DE,
  checklistSections,
  itemText,
  type ChecklistItem,
  type ItemLanguage,
} from '../../domain/checklist/items';
import { checklistSuggestions } from '../../domain/checklist/suggestions';
import type { ChecklistEntry } from '../../domain/types';
import { suggestionLabels } from '../export/labels';
import { useProject } from '../project/useProject';
import styles from './Checklist.module.css';
import { ChecklistPdfButton } from './ChecklistPdfButton';

type Filter = 'all' | ChecklistEntry['status'];
const FILTERS: readonly Filter[] = ['all', 'open', 'done', 'na'];
const STATUSES: readonly ChecklistEntry['status'][] = ['open', 'done', 'na'];
const ITEM_IDS = CHECKLIST_ITEMS.map((item) => item.id);

export default function ChecklistPage() {
  const { t, i18n } = useTranslation();
  const project = useProject();
  const entries = useLiveQuery(() => listChecklist(db, project.id), [project.id]);
  const data = useLiveQuery(() => listScreeningData(db, project.id), [project.id]);
  const [filter, setFilter] = useState<Filter>('all');
  const [message, setMessage] = useState('');
  const language: ItemLanguage = i18n.language.startsWith('de') ? 'de' : 'en';

  const suggestions = useMemo(
    () =>
      data?.project
        ? checklistSuggestions(
            {
              ...data,
              project: data.project,
              sourceRuns: data.runs,
              importBatches: data.batches,
              duplicateGroups: data.groups,
            },
            suggestionLabels(t),
          )
        : {},
    [data, t],
  );

  if (!entries) return <p>{t('common.loading')}</p>;
  const byItem = new Map(entries.map((entry) => [entry.itemId, entry]));
  const progress = checklistProgress(entries, ITEM_IDS);
  const visible = (item: ChecklistItem) =>
    filter === 'all' || (byItem.get(item.id)?.status ?? 'open') === filter;

  return (
    <>
      <PageHeading
        title={t('modules.checklist.title')}
        description={t('modules.checklist.description')}
      />
      {language === 'de' && (
        <p className={`${notice.notice} ${notice.warning}`} lang="de">
          {TRANSLATION_NOTICE_DE}
        </p>
      )}
      <p className={styles.source}>{t('checklist.source', { source: CHECKLIST_SOURCE })}</p>

      <section aria-labelledby="checklist-progress" className={styles.summary}>
        <h2 id="checklist-progress" className="visually-hidden">
          {t('checklist.progressHeading')}
        </h2>
        <label htmlFor="checklist-progress-bar">
          {t('checklist.progress', {
            done: progress.done,
            na: progress.na,
            open: progress.open,
            total: progress.total,
          })}
        </label>
        <progress
          id="checklist-progress-bar"
          value={progress.done + progress.na}
          max={progress.total}
        />
        <ToggleGroup
          label={t('checklist.filterLabel')}
          options={FILTERS.map((value) => ({ value, label: t(`checklist.filter.${value}`) }))}
          value={filter}
          onChange={setFilter}
        />
        <ChecklistPdfButton entries={entries} projectTitle={project.title} onDone={setMessage} />
      </section>

      <p role="status" className={message ? notice.notice : 'visually-hidden'}>
        {message}
      </p>

      {checklistSections().map((section) => {
        const items = section.items.filter(visible);
        if (items.length === 0) return null;
        const heading = itemText(section.items[0]!, language).section;
        const headingId = `section-${section.section.replace(/\W+/g, '-')}`;
        return (
          <section key={section.section} aria-labelledby={headingId} className={styles.section}>
            <h2 id={headingId}>{heading}</h2>
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                language={language}
                entry={byItem.get(item.id)}
                projectId={project.id}
                suggestion={suggestions[item.id]}
                onSaved={setMessage}
              />
            ))}
          </section>
        );
      })}
    </>
  );
}

interface ItemProps {
  item: ChecklistItem;
  language: ItemLanguage;
  entry: ChecklistEntry | undefined;
  projectId: string;
  suggestion: Suggestion | undefined;
  onSaved: (message: string) => void;
}

function ItemCard({ item, language, entry, projectId, suggestion, onSaved }: ItemProps) {
  const { t } = useTranslation();
  const text = itemText(item, language);
  const base = { projectId, itemId: item.id };
  const current: ChecklistEntry = entry ?? { ...base, status: 'open' };
  const [location, setLocation] = useState(current.location ?? '');
  const [note, setNote] = useState(current.note ?? '');
  const [pending, setPending] = useState<{ entry: ChecklistEntry; fields: string[] }>();
  const titleId = `item-${item.id}`;
  const name = t('checklist.itemName', { id: item.id, topic: text.topic });

  const save = async (next: ChecklistEntry) => {
    await saveChecklistEntry(db, next, nowIso());
    onSaved(t('checklist.saved', { name }));
  };
  const saveText = () => {
    if (location === (current.location ?? '') && note === (current.note ?? '')) return;
    void save({ ...current, location, note });
  };
  const apply = (next: ChecklistEntry) => {
    setLocation(next.location ?? '');
    setNote(next.note ?? '');
    void save(next);
  };
  const adopt = () => {
    if (!suggestion) return;
    const result = adoptSuggestion({ ...current, location, note }, base, suggestion);
    if (result.overwrites.length > 0)
      setPending({
        entry: result.entry,
        fields: result.overwrites.map((field) => t(`checklist.fields.${field}`)),
      });
    else apply(result.entry);
  };

  return (
    <article aria-labelledby={titleId} className={styles.item}>
      <h3 id={titleId} className={styles.itemTitle}>
        <span className={styles.itemId}>{item.id}</span> {text.topic}
      </h3>
      <p lang={language} className={styles.itemText}>
        {text.text}
      </p>
      {language === 'de' && (
        <details className={styles.original}>
          <summary>{t('checklist.original')}</summary>
          <p lang="en">{item.text_en}</p>
        </details>
      )}

      <fieldset className={styles.status}>
        <legend className={forms.legend}>{t('checklist.statusLegend', { name })}</legend>
        {STATUSES.map((status) => (
          <label key={status} className={forms.radioOption}>
            <input
              type="radio"
              name={`status-${item.id}`}
              value={status}
              checked={current.status === status}
              onChange={() => void save({ ...current, location, note, status })}
            />
            {t(`checklist.status.${status}`)}
          </label>
        ))}
      </fieldset>

      <div className={styles.fields}>
        <TextField
          id={`location-${item.id}`}
          label={t('checklist.fields.location')}
          hint={t('checklist.locationHint')}
          value={location}
          onChange={setLocation}
          onBlur={saveText}
        />
        <TextField
          id={`note-${item.id}`}
          label={t('checklist.fields.note')}
          multiline
          rows={2}
          value={note}
          onChange={setNote}
          onBlur={saveText}
        />
      </div>

      {suggestion && (
        <aside aria-labelledby={`${titleId}-suggestion`} className={styles.suggestion}>
          <h4 id={`${titleId}-suggestion`}>{t('checklist.suggestionHeading')}</h4>
          <p className={styles.suggestionText}>{suggestion.note}</p>
          {suggestion.location && (
            <p className={styles.suggestionText}>
              {t('checklist.fields.location')}: {suggestion.location}
            </p>
          )}
          <button type="button" className={`${button.button} ${button.small}`} onClick={adopt}>
            {(current.note ?? note).trim() || (current.location ?? location).trim()
              ? t('checklist.replace')
              : t('checklist.adopt')}
            <span className="visually-hidden">{` – ${name}`}</span>
          </button>
        </aside>
      )}

      <ConfirmDialog
        open={pending !== undefined}
        title={t('checklist.confirmTitle', { name })}
        onCancel={() => setPending(undefined)}
        actions={[
          {
            label: t('checklist.confirmReplace'),
            variant: 'primary',
            onSelect: () => {
              if (pending) apply(pending.entry);
              setPending(undefined);
            },
          },
        ]}
      >
        <p>{t('checklist.confirmBody', { fields: pending?.fields.join(', ') ?? '' })}</p>
      </ConfirmDialog>
    </article>
  );
}

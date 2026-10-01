import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { db } from '../../db/db';
import { deleteRun, RecordsExistError, saveRun } from '../../db/searchRepository';
import {
  createRun,
  draftFromRun,
  pruneRun,
  runFromDraft,
  type RunDraft,
} from '../../domain/search/createSearch';
import { SOURCE_TYPE_CONFIG, type RunField } from '../../domain/search/sourceTypes';
import { sourceLabel } from '../../domain/search/summary';
import { hasErrors, validateRun, type RunIssue } from '../../domain/search/validateSearch';
import type { Source, SourceRun } from '../../domain/types';
import { formatDate } from '../../app/format';
import NotFoundPage from '../../app/NotFoundPage';
import { searchPaths } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import { newId, nowIso, todayLocal } from '../../app/runtime';
import button from '../../design/button.module.css';
import { ConfirmDialog } from '../../design/ConfirmDialog';
import { ErrorSummary } from '../../design/ErrorSummary';
import { RadioGroup, TextField } from '../../design/Field';
import forms from '../../design/forms.module.css';
import notice from '../../design/notice.module.css';
import { useProject } from '../project/useProject';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { useNavigateAfterSave } from './useNavigateAfterSave';

const TOOL_LIST_ID = 'tool-suggestions';

/** Add a run (route with sourceId) or edit one (route with runId). */
export default function RunFormPage() {
  const project = useProject();
  const { sourceId, runId } = useParams();
  const data = useLiveQuery(async () => {
    const run = runId ? await db.sourceRuns.get(runId) : undefined;
    const source = await db.sources.get(run?.sourceId ?? sourceId ?? '');
    return { run: run ?? null, source: source ?? null };
  }, [sourceId, runId]);
  // Created once per page visit: a new id on every render would remount the form.
  const [blankId] = useState(newId);
  if (data === undefined) return null; // loading
  const { source, run } = data;
  if (!source || source.projectId !== project.id || (runId && !run)) return <NotFoundPage />;
  const initial =
    run ??
    createRun({ projectId: project.id, sourceId: source.id, date: todayLocal() }, () => blankId);
  return <RunForm key={initial.id} source={source} initial={initial} isNew={!run} />;
}

function RunForm({
  source,
  initial,
  isNew,
}: {
  source: Source;
  initial: SourceRun;
  isNew: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { saved, leaveTo } = useNavigateAfterSave();
  const [draft, setDraft] = useState<RunDraft>(() => draftFromRun(initial));
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');
  const config = SOURCE_TYPE_CONFIG[source.type];
  const shows = (field: RunField) => config.runFields.includes(field);
  const required = (field: RunField) => config.requiredRunFields.includes(field);
  const hasPeriod = shows('dateTo');

  const run = pruneRun(source.type, runFromDraft(draft));
  const issues = validateRun(source.type, run, todayLocal());
  const dirty = !saved && JSON.stringify(run) !== JSON.stringify(pruneRun(source.type, initial));
  const set = (field: keyof RunDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const issueFor = (field: RunIssue['field']) => issues.find((issue) => issue.field === field);
  const errorFor = (field: RunIssue['field']) => {
    const issue = issueFor(field);
    return submitted && issue?.severity === 'error' ? t(`validation.${issue.code}`) : undefined;
  };
  const label = (field: RunIssue['field']): string => {
    switch (field) {
      case 'date':
        return hasPeriod ? t('runForm.dateStart') : t('runForm.date');
      case 'searchString':
        return source.type === 'website' ? t('runForm.searchTerms') : t('runForm.searchString');
      case 'method':
        return t('runForm.method');
      case 'citationDirection':
        return t('runForm.citationDirection');
      default:
        return t(`runForm.${field}`);
    }
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(issues)) return;
    await saveRun(db, run, nowIso());
    leaveTo(searchPaths.page(source.projectId));
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await deleteRun(db, initial.id, nowIso());
      leaveTo(searchPaths.page(source.projectId));
    } catch (error) {
      if (!(error instanceof RecordsExistError)) throw error;
      setMessage(t('runForm.deleteBlocked', { count: error.count }));
    }
  }

  async function copySearchString() {
    try {
      await navigator.clipboard.writeText(draft.searchString);
      setMessage(t('runForm.copied'));
    } catch {
      setMessage(t('runForm.copyFailed'));
    }
  }

  type TextOptions = Omit<Parameters<typeof TextField>[0], 'label' | 'value' | 'onChange'>;
  const text = (field: RunIssue['field'] & keyof RunDraft, options: TextOptions = {}) => (
    <TextField
      id={`run-${field}`}
      label={label(field)}
      required={field === 'date' || required(field as RunField)}
      value={draft[field]}
      error={errorFor(field)}
      onChange={set(field)}
      {...options}
    />
  );
  const futureDate = issueFor('date')?.code === 'futureDate';
  const toolHint =
    source.type === 'search_engine' || source.type === 'citation_search'
      ? t(`runForm.toolHint.${source.type}`)
      : undefined;
  const toolSuggestions =
    source.type === 'search_engine'
      ? ['Publish or Perish', 'GSscraper']
      : ['Citationchaser', 'Scopus', 'Web of Science', t('runForm.manual')];

  return (
    <>
      <PageHeading
        title={t(isNew ? 'runForm.newTitle' : 'runForm.editTitle')}
        description={t('runForm.source', { source: sourceLabel(source) })}
      />
      {submitted && hasErrors(issues) && (
        <ErrorSummary
          title={t('form.errorSummary')}
          items={issues
            .filter((issue) => issue.severity === 'error')
            .map((issue) => ({
              target: `run-${issue.field}`,
              message: `${label(issue.field)}: ${t(`validation.${issue.code}`)}`,
            }))}
        />
      )}
      <p role="status" className={message ? notice.notice : 'visually-hidden'}>
        {message}
      </p>
      <form className={forms.section} noValidate onSubmit={(event) => void submit(event)}>
        <div className={forms.grid2}>
          <div className={forms.field}>
            {text('date', { type: 'date', hint: t('runForm.dateHint') })}
            {futureDate && <p className={forms.warning}>{t('validation.futureDate')}</p>}
          </div>
          {hasPeriod && text('dateTo', { type: 'date', hint: t('runForm.dateToHint') })}
        </div>

        {shows('method') && (
          <RadioGroup
            id="run-method"
            legend={label('method')}
            required={required('method')}
            error={errorFor('method')}
            value={draft.method as 'search' | 'browse' | ''}
            options={[
              { value: 'search', label: t('runForm.methods.search') },
              { value: 'browse', label: t('runForm.methods.browse') },
            ]}
            onChange={set('method')}
          />
        )}
        {shows('citationDirection') && (
          <RadioGroup
            id="run-citationDirection"
            legend={label('citationDirection')}
            required={required('citationDirection')}
            error={errorFor('citationDirection')}
            value={draft.citationDirection as 'backward' | 'forward' | 'both' | ''}
            options={[
              { value: 'backward', label: t('runForm.directions.backward') },
              { value: 'forward', label: t('runForm.directions.forward') },
              { value: 'both', label: t('runForm.directions.both') },
            ]}
            onChange={set('citationDirection')}
          />
        )}
        {shows('seedDocuments') &&
          text('seedDocuments', { multiline: true, rows: 3, hint: t('runForm.seedDocumentsHint') })}
        {shows('description') &&
          text('description', { multiline: true, rows: 4, hint: t('runForm.descriptionHint') })}

        {shows('searchString') && (
          <div className={forms.field}>
            {text('searchString', {
              multiline: true,
              rows: source.type === 'website' ? 2 : 10,
              code: source.type !== 'website',
              hint:
                source.type === 'website'
                  ? t('runForm.searchTermsHint')
                  : t('runForm.searchStringHint'),
            })}
            {source.type !== 'website' && (
              <div>
                <button
                  type="button"
                  className={`${button.button} ${button.small}`}
                  onClick={() => void copySearchString()}
                >
                  {t('runForm.copy')}
                </button>
              </div>
            )}
          </div>
        )}
        {shows('limits') && (
          <div className={forms.field}>
            {text('limits', {
              multiline: true,
              rows: 2,
              hint: t('runForm.limitsHint'),
              disabled: draft.noLimits,
            })}
            <label className={forms.radioOption}>
              <input
                type="checkbox"
                checked={draft.noLimits}
                onChange={(event) => {
                  const noLimits = event.target.checked;
                  setDraft((current) => ({ ...current, noLimits }));
                }}
              />
              {t('runForm.noLimits')}
            </label>
          </div>
        )}

        <div className={forms.grid2}>
          {shows('reportedHits') &&
            text('reportedHits', { inputMode: 'numeric', hint: t('runForm.reportedHitsHint') })}
          {shows('recordsChecked') &&
            text('recordsChecked', {
              inputMode: 'numeric',
              hint: t('runForm.recordsCheckedHint'),
            })}
        </div>
        {shows('tool') && (
          <>
            {text('tool', { hint: toolHint, list: TOOL_LIST_ID })}
            <datalist id={TOOL_LIST_ID}>
              {toolSuggestions.map((tool) => (
                <option key={tool} value={tool} />
              ))}
            </datalist>
          </>
        )}
        {shows('notes') && text('notes', { multiline: true, rows: 2 })}

        <div className={forms.actions}>
          <button type="submit" className={`${button.button} ${button.primary}`}>
            {t('common.save')}
          </button>
          <Link to={searchPaths.page(source.projectId)} className={button.button}>
            {t('common.cancel')}
          </Link>
          {!isNew && (
            <button
              type="button"
              className={`${button.button} ${button.danger}`}
              onClick={() => setConfirmDelete(true)}
            >
              {t('runForm.delete')}
            </button>
          )}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        title={t('runForm.deleteTitle')}
        onCancel={() => setConfirmDelete(false)}
        actions={[
          { label: t('common.deleteConfirm'), variant: 'danger', onSelect: () => void remove() },
        ]}
      >
        <p>{t('runForm.deleteBody', { date: formatDate(initial.date, i18n.language) })}</p>
      </ConfirmDialog>
      <UnsavedChangesGuard when={dirty} />
    </>
  );
}

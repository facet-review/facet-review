import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatDate, formatNumber } from '../../../app/format';
import { importPaths, searchPaths } from '../../../app/modules';
import { PageHeading } from '../../../app/PageHeading';
import { newId, nowIso, todayLocal } from '../../../app/runtime';
import { db } from '../../../db/db';
import { saveOpenAlexImport } from '../../../db/openalexRepository';
import { listSources } from '../../../db/searchRepository';
import button from '../../../design/button.module.css';
import { ErrorSummary } from '../../../design/ErrorSummary';
import { FormSection, RadioGroup, TextField } from '../../../design/Field';
import forms from '../../../design/forms.module.css';
import notice from '../../../design/notice.module.css';
import {
  countWorks,
  fetchAllWorks,
  OpenAlexError,
  type FetchProgress,
} from '../../../domain/openalex/client';
import { createOpenAlexImport } from '../../../domain/openalex/import';
import type { ProtocolLabel } from '../../../domain/openalex/protocol';
import {
  MAX_IMPORT,
  parseLanguages,
  validateQuery,
  type QueryIssue,
} from '../../../domain/openalex/query';
import {
  SEARCH_FIELDS,
  WORK_TYPES,
  type OpenAlexQuery,
  type SearchField,
} from '../../../domain/openalex/types';
import { recomputeDuplicates } from '../../import/dedupService';
import { useProject } from '../../project/useProject';
import styles from '../SearchPage.module.css';
import { browserDeps } from './http';
import { useOnline } from './useOnline';
import { useOpenAlexSettings } from './useOpenAlexSettings';

interface Form {
  text: string;
  field: SearchField;
  fromYear: string;
  toYear: string;
  types: string[];
  languages: string;
  openAccessOnly: boolean;
}

const EMPTY: Form = {
  text: '',
  field: 'title_and_abstract',
  fromYear: '',
  toYear: '',
  types: [],
  languages: '',
  openAccessOnly: false,
};

const year = (value: string) => (value.trim() === '' ? undefined : Number(value.trim()));

function toQuery(form: Form): OpenAlexQuery {
  const query: OpenAlexQuery = {
    text: form.text,
    field: form.field,
    types: WORK_TYPES.filter((type) => form.types.includes(type)),
    languages: parseLanguages(form.languages),
    openAccessOnly: form.openAccessOnly,
  };
  const from = year(form.fromYear);
  const to = year(form.toYear);
  if (from !== undefined) query.fromYear = from;
  if (to !== undefined) query.toYear = to;
  return query;
}

const ISSUE_TARGET: Record<QueryIssue, string> = {
  textMissing: 'openalex-text',
  textComma: 'openalex-text',
  yearInvalid: 'openalex-from',
  yearOrder: 'openalex-from',
  languageInvalid: 'openalex-languages',
};

type Phase =
  | { kind: 'idle' }
  | { kind: 'counting' }
  | { kind: 'counted'; key: string; count: number; preview: string[] }
  | { kind: 'loading'; progress?: FetchProgress }
  | { kind: 'done'; count: number; date: string }
  | { kind: 'failed'; message: string };

/** Module 2: search OpenAlex directly; the search run is documented automatically. */
export default function OpenAlexPage() {
  const { t, i18n } = useTranslation();
  const project = useProject();
  const online = useOnline();
  const [settings, updateSetting] = useOpenAlexSettings();
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const abort = useRef<AbortController | undefined>(undefined);

  const query = toQuery(form);
  const key = JSON.stringify(query);
  const issues = validateQuery(query);
  const busy = phase.kind === 'counting' || phase.kind === 'loading';
  const stale = phase.kind === 'counted' && phase.key !== key;
  const credentials = { mailto: settings.mailto, apiKey: settings.apiKey };
  const lang = i18n.language;
  const label: ProtocolLabel = (labelKey, vars) => t(`openalex.protocol.${labelKey}`, vars ?? {});

  const set =
    <K extends keyof Form>(field: K) =>
    (value: Form[K]) => {
      setForm((current) => ({ ...current, [field]: value }));
    };

  const errorMessage = (error: unknown) => {
    if (error instanceof OpenAlexError) {
      return t(`openalex.errors.${error.code}`, {
        status: formatNumber(error.detail ?? 0, lang),
        max: formatNumber(MAX_IMPORT, lang),
      });
    }
    return t('openalex.errors.save');
  };

  async function count(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (issues.length > 0 || busy || !online) return;
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: 'counting' });
    try {
      const result = await countWorks(query, credentials, browserDeps, controller.signal);
      setPhase({ kind: 'counted', key, ...result });
    } catch (error) {
      setPhase({ kind: 'failed', message: errorMessage(error) });
    }
  }

  async function runImport() {
    if (phase.kind !== 'counted' || stale || !online) return;
    const controller = new AbortController();
    abort.current = controller;
    setPhase({ kind: 'loading' });
    try {
      const result = await fetchAllWorks(query, credentials, browserDeps, {
        signal: controller.signal,
        onProgress: (progress) => setPhase({ kind: 'loading', progress }),
      });
      const date = todayLocal();
      const data = createOpenAlexImport(
        query,
        result,
        { projectId: project.id, sources: await listSources(db, project.id), date, label },
        { newId, now: nowIso },
      );
      await saveOpenAlexImport(db, data, nowIso());
      await recomputeDuplicates(project.id);
      setPhase({ kind: 'done', count: data.records.length, date });
    } catch (error) {
      setPhase({ kind: 'failed', message: errorMessage(error) });
    }
  }

  const status = (() => {
    switch (phase.kind) {
      case 'counting':
        return t('openalex.counting');
      case 'loading':
        return phase.progress
          ? t('openalex.loading', {
              page: phase.progress.page,
              pages: phase.progress.pages,
              loaded: formatNumber(phase.progress.loaded, lang),
              count: formatNumber(phase.progress.count, lang),
            })
          : t('openalex.counting');
      case 'counted':
        return t('openalex.result', { count: formatNumber(phase.count, lang) });
      case 'done':
        return t('openalex.done', {
          count: formatNumber(phase.count, lang),
          date: formatDate(phase.date, lang),
        });
      default:
        return '';
    }
  })();

  return (
    <>
      <PageHeading title={t('openalex.title')} description={t('openalex.description')} />
      <p className={notice.notice}>{t('openalex.privacy')}</p>
      {!online && <p className={`${notice.notice} ${notice.warning}`}>{t('openalex.offline')}</p>}

      {submitted && (
        <ErrorSummary
          title={t('openalex.errorTitle')}
          items={issues.map((issue) => ({
            target: ISSUE_TARGET[issue],
            message: t(`openalex.issues.${issue}`),
          }))}
        />
      )}

      <form noValidate onSubmit={(event) => void count(event)}>
        <FormSection title={t('openalex.searchHeading')}>
          <TextField
            id="openalex-text"
            label={t('openalex.text')}
            hint={t('openalex.textHint')}
            required
            multiline
            rows={3}
            code
            value={form.text}
            onChange={set('text')}
            error={
              submitted && issues.includes('textMissing')
                ? t('openalex.issues.textMissing')
                : submitted && issues.includes('textComma')
                  ? t('openalex.issues.textComma')
                  : undefined
            }
          />
          <RadioGroup
            legend={t('openalex.field')}
            value={form.field}
            options={SEARCH_FIELDS.map((value) => ({
              value,
              label: t(`openalex.fields.${value}`),
            }))}
            onChange={set('field')}
          />
        </FormSection>

        <FormSection title={t('openalex.limitsHeading')}>
          <div className={forms.grid2}>
            <TextField
              id="openalex-from"
              label={t('openalex.fromYear')}
              inputMode="numeric"
              value={form.fromYear}
              onChange={set('fromYear')}
              error={
                submitted && (issues.includes('yearInvalid') || issues.includes('yearOrder'))
                  ? t(
                      `openalex.issues.${issues.includes('yearInvalid') ? 'yearInvalid' : 'yearOrder'}`,
                    )
                  : undefined
              }
            />
            <TextField
              id="openalex-to"
              label={t('openalex.toYear')}
              inputMode="numeric"
              value={form.toYear}
              onChange={set('toYear')}
            />
          </div>
          <fieldset className={forms.fieldset} aria-describedby="openalex-types-hint">
            <legend className={forms.legend}>{t('openalex.types')}</legend>
            <p id="openalex-types-hint" className={forms.hint}>
              {t('openalex.typesHint')}
            </p>
            {WORK_TYPES.map((type) => (
              <label key={type} className={forms.radioOption}>
                <input
                  type="checkbox"
                  checked={form.types.includes(type)}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setForm((current) => ({
                      ...current,
                      types: checked
                        ? [...current.types, type]
                        : current.types.filter((value) => value !== type),
                    }));
                  }}
                />
                {t(`openalex.typeNames.${type}`)}
              </label>
            ))}
          </fieldset>
          <TextField
            id="openalex-languages"
            label={t('openalex.languages')}
            hint={t('openalex.languagesHint')}
            value={form.languages}
            onChange={set('languages')}
            error={
              submitted && issues.includes('languageInvalid')
                ? t('openalex.issues.languageInvalid')
                : undefined
            }
          />
          <label className={forms.radioOption}>
            <input
              type="checkbox"
              checked={form.openAccessOnly}
              onChange={(event) => set('openAccessOnly')(event.target.checked)}
            />
            {t('openalex.openAccess')}
          </label>
        </FormSection>

        <details className={forms.section}>
          <summary>{t('openalex.settingsHeading')}</summary>
          <p className={forms.hint}>{t('openalex.settingsHint')}</p>
          <TextField
            id="openalex-mailto"
            label={t('openalex.mailto')}
            hint={t('openalex.mailtoHint')}
            autoComplete="email"
            value={settings.mailto}
            onChange={(value) => updateSetting('mailto', value)}
          />
          <TextField
            id="openalex-key"
            label={t('openalex.apiKey')}
            hint={t('openalex.apiKeyHint')}
            value={settings.apiKey}
            onChange={(value) => updateSetting('apiKey', value)}
          />
        </details>

        <div className={styles.actions}>
          <button
            type="submit"
            className={button.button}
            aria-disabled={busy || !online || undefined}
          >
            {t('openalex.count')}
          </button>
        </div>
      </form>

      <p role="status" className={status ? notice.notice : 'visually-hidden'}>
        {status}
      </p>
      {phase.kind === 'failed' && (
        <p role="alert" className={`${notice.notice} ${notice.error}`}>
          {phase.message}
        </p>
      )}

      {phase.kind === 'counted' && (
        <section aria-labelledby="openalex-preview" className={forms.section}>
          <h2 id="openalex-preview" className={forms.sectionHeading}>
            {t('openalex.previewHeading')}
          </h2>
          {phase.preview.length > 0 && (
            <ul>
              {phase.preview.map((title, index) => (
                <li key={index}>{title}</li>
              ))}
            </ul>
          )}
          {stale ? (
            <p className={`${notice.notice} ${notice.warning}`}>{t('openalex.stale')}</p>
          ) : phase.count === 0 ? (
            <p>{t('openalex.none')}</p>
          ) : phase.count > MAX_IMPORT ? (
            <p className={`${notice.notice} ${notice.warning}`}>
              {t('openalex.tooMany', { max: formatNumber(MAX_IMPORT, lang) })}
            </p>
          ) : (
            <button
              type="button"
              className={`${button.button} ${button.primary}`}
              aria-disabled={!online || undefined}
              onClick={() => void runImport()}
            >
              {t('openalex.import', { count: formatNumber(phase.count, lang) })}
            </button>
          )}
        </section>
      )}

      {busy && (
        <button type="button" className={button.button} onClick={() => abort.current?.abort()}>
          {t('openalex.cancel')}
        </button>
      )}

      {phase.kind === 'done' && (
        <div className={styles.actions}>
          <Link to={importPaths.page(project.id)} className={`${button.button} ${button.primary}`}>
            {t('openalex.toImport')}
          </Link>
          <Link to={searchPaths.page(project.id)} className={button.button}>
            {t('openalex.toSearch')}
          </Link>
        </div>
      )}
    </>
  );
}

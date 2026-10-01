import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../app/format';
import { newId, nowIso } from '../../app/runtime';
import { db } from '../../db/db';
import { addDedupDecision } from '../../db/importRepository';
import button from '../../design/button.module.css';
import forms from '../../design/forms.module.css';
import notice from '../../design/notice.module.css';
import { normalizeTitle } from '../../domain/import/normalize';
import type { DecisionInput } from '../../domain/screening/decide';
import type { UnitScreening } from '../../domain/screening/stages';
import type { StageStatus } from '../../domain/screening/status';
import {
  isIncludedReport,
  planStudyAssignment,
  planStudyDetach,
  studyGroups,
} from '../../domain/screening/studies';
import type { Decision } from '../../domain/types';
import { recomputeDuplicates } from '../import/dedupService';
import { assignStudy } from './actions';
import { recordSummary } from './display';
import styles from './Screening.module.css';
import type { ScreeningData } from './useScreening';

function useDescribe(data: ScreeningData) {
  const { t } = useTranslation();
  const reasons = new Map(data.project.exclusionReasons.map((r) => [r.id, r.label]));
  return (decision: Decision) =>
    [
      t(`screening.value.${decision.value}`),
      decision.reasonId && reasons.get(decision.reasonId),
      decision.studyId &&
        t('screening.study.of', { label: data.studies.get(decision.studyId)?.label ?? '' }),
    ]
      .filter(Boolean)
      .join(' – ');
}

/** Current status, conflict or split hint of the unit in this stage. */
export function StatusNotice({
  data,
  status,
  onAdopt,
}: {
  data: ScreeningData;
  status: StageStatus;
  onAdopt: (input: DecisionInput) => void;
}) {
  const { t } = useTranslation();
  const describe = useDescribe(data);
  if (status.state === 'conflict') {
    return (
      <div className={`${notice.notice} ${notice.warning}`}>
        <p>{t('screening.status.conflict')}</p>
        <ul>
          {status.conflicting.map((d) => (
            <li key={d.id}>{describe(d)}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (status.state === 'open' && status.suggestion) {
    const suggestion = status.suggestion;
    return (
      <div className={`${notice.notice} ${notice.warning}`}>
        <p>{t('screening.status.split', { decision: describe(suggestion) })}</p>
        <button
          type="button"
          className={`${button.button} ${button.small}`}
          onClick={() =>
            onAdopt({
              stage: suggestion.stage,
              value: suggestion.value,
              ...(suggestion.reasonId && { reasonId: suggestion.reasonId }),
              ...(suggestion.studyId && { studyId: suggestion.studyId }),
            })
          }
        >
          {t('screening.status.adopt')}
        </button>
      </div>
    );
  }
  if (status.state === 'decided') {
    return (
      <p className={notice.notice}>
        {t('screening.status.current', { decision: describe(status.decision!) })}
        {status.inherited && ` ${t('screening.status.inherited')}`}
      </p>
    );
  }
  return <p className={styles.muted}>{t('screening.status.open')}</p>;
}

/** "Reports vs. studies" (PRD Modul 4): assign an included report to another report's study. */
export function StudySection({
  data,
  screening,
  onDone,
}: {
  data: ScreeningData;
  screening: UnitScreening;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [anchorKey, setAnchorKey] = useState('');
  if (!isIncludedReport(screening)) return null;
  const who = { projectId: data.project.id, reviewerId: data.reviewerId };
  const groups = studyGroups(data.evaluated);
  const own = groups.find((g) => g.reports.includes(screening))!;
  const others = data.evaluated.filter((s) => s !== screening && isIncludedReport(s));
  const label = (s: UnitScreening) => {
    const summary = recordSummary(data.records.get(s.unit.primaryId));
    return [summary.firstAuthor, summary.year, summary.title].filter(Boolean).join(' · ');
  };
  const studyLabel = own.studyId ? data.studies.get(own.studyId)?.label : undefined;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const anchor = others.find((s) => s.unit.key === anchorKey);
    if (!anchor) return;
    const summary = recordSummary(data.records.get(anchor.unit.primaryId));
    const plan = planStudyAssignment(screening, anchor, {
      newId,
      label: [summary.firstAuthor, summary.year].filter(Boolean).join(' ') || label(anchor),
    });
    if (!plan) return;
    await assignStudy(who, plan.study, plan.decisions);
    setAnchorKey('');
    onDone(t('screening.study.assigned'));
  };

  return (
    <section aria-labelledby="study-heading" className={styles.panel}>
      <h2 id="study-heading" className={styles.panelHeading}>
        {t('screening.study.heading')}
      </h2>
      {own.studyId ? (
        <p>
          {t('screening.study.member', { label: studyLabel ?? '', count: own.reports.length })}{' '}
          <button
            type="button"
            className={`${button.button} ${button.small}`}
            onClick={() => {
              const plan = planStudyDetach(screening);
              void assignStudy(who, undefined, [plan]).then(() =>
                onDone(t('screening.study.detached')),
              );
            }}
          >
            {t('screening.study.detach')}
          </button>
        </p>
      ) : (
        <p className={styles.muted}>{t('screening.study.own')}</p>
      )}
      {others.length > 0 && (
        <form className={styles.inlineRow} onSubmit={(event) => void submit(event)}>
          <div className={forms.field}>
            <label htmlFor="study-anchor" className={forms.label}>
              {t('screening.study.assignLabel')}
            </label>
            <select
              id="study-anchor"
              className={forms.input}
              value={anchorKey}
              onChange={(event) => setAnchorKey(event.target.value)}
            >
              <option value="">{t('screening.study.choose')}</option>
              {others.map((s) => (
                <option key={s.unit.key} value={s.unit.key}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={button.button}>
            {t('screening.study.assign')}
          </button>
        </form>
      )}
    </section>
  );
}

const REMOVAL_VALUES = ['remove_automation', 'remove_other'] as const;

/** Removed before screening (PRD Modul 3): automation tool or other reason, with note. */
export function RemovalSection({
  screening,
  onDecide,
}: {
  screening: UnitScreening;
  onDecide: (input: DecisionInput) => void;
}) {
  const { t } = useTranslation();
  const [by, setBy] = useState<'remove_automation' | 'remove_other'>('remove_other');
  const [note, setNote] = useState('');
  const [missing, setMissing] = useState(false);

  if (screening.removed) {
    const decision = screening.removal.decision ?? screening.removal.conflicting[0];
    return (
      <section aria-labelledby="removal-heading" className={styles.panel}>
        <h2 id="removal-heading" className={styles.panelHeading}>
          {t('screening.removal.heading')}
        </h2>
        <p className={`${notice.notice} ${notice.warning}`}>
          {t('screening.removal.removed', {
            how: t(`screening.value.${decision?.value ?? 'remove_other'}`),
            note: decision?.note ?? '',
          })}
        </p>
        <button
          type="button"
          className={button.button}
          onClick={() => onDecide({ stage: 'pre_screening', value: 'reset' })}
        >
          {t('screening.removal.restore')}
        </button>
      </section>
    );
  }

  return (
    <details className={styles.more}>
      <summary>{t('screening.removal.heading')}</summary>
      <form
        className={styles.inlineForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!note.trim()) {
            setMissing(true);
            return;
          }
          onDecide({ stage: 'pre_screening', value: by, note });
        }}
      >
        <fieldset className={forms.fieldset}>
          <legend className={forms.legend}>{t('screening.removal.by')}</legend>
          {REMOVAL_VALUES.map((value) => (
            <label key={value} className={forms.radioOption}>
              <input
                type="radio"
                name="removal-by"
                value={value}
                checked={by === value}
                onChange={() => setBy(value)}
              />
              {t(`screening.value.${value}`)}
            </label>
          ))}
        </fieldset>
        <div className={forms.field}>
          <label htmlFor="removal-note" className={forms.label}>
            {t('screening.removal.note')}{' '}
            <span className={forms.requiredMark}>({t('common.required')})</span>
          </label>
          <input
            id="removal-note"
            className={forms.input}
            value={note}
            required
            aria-invalid={missing || undefined}
            aria-describedby={missing ? 'removal-note-error' : undefined}
            autoComplete="off"
            onChange={(event) => {
              setNote(event.target.value);
              setMissing(false);
            }}
          />
          {missing && (
            <p id="removal-note-error" className={forms.error}>
              {t('screening.removal.noteRequired')}
            </p>
          )}
        </div>
        <div>
          <button type="submit" className={`${button.button} ${button.danger}`}>
            {t('screening.removal.submit')}
          </button>
        </div>
      </form>
    </details>
  );
}

/** Manual duplicate marking (deferred from milestone 3): search by title, then merge. */
export function MarkDuplicateSection({
  data,
  screening,
  onDone,
}: {
  data: ScreeningData;
  screening: UnitScreening;
  onDone: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const needle = normalizeTitle(query);
  const results =
    needle.length < 3
      ? []
      : data.evaluated
          .filter((s) => s !== screening && !s.removed)
          .filter((s) =>
            normalizeTitle(recordSummary(data.records.get(s.unit.primaryId)).title).includes(
              needle,
            ),
          )
          .slice(0, 10);

  const merge = async (other: UnitScreening) => {
    await addDedupDecision(
      db,
      {
        id: newId(),
        projectId: data.project.id,
        recordIds: [screening.unit.primaryId, other.unit.primaryId],
        value: 'merge',
        reviewerId: data.reviewerId,
        timestamp: nowIso(),
      },
      nowIso(),
    );
    await recomputeDuplicates(data.project.id);
    onDone(t('screening.duplicate.merged'));
  };

  return (
    <details className={styles.more}>
      <summary>{t('screening.duplicate.heading')}</summary>
      <div className={styles.inlineForm}>
        <div className={forms.field}>
          <label htmlFor="duplicate-search" className={forms.label}>
            {t('screening.duplicate.search')}
          </label>
          <input
            id="duplicate-search"
            type="search"
            className={forms.input}
            value={query}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {needle.length >= 3 && (
          <p role="status" className={forms.hint}>
            {t('screening.duplicate.results', { count: results.length })}
          </p>
        )}
        {results.length > 0 && (
          <ul className={styles.plainList}>
            {results.map((s) => {
              const summary = recordSummary(data.records.get(s.unit.primaryId));
              const title = summary.title || t('screening.untitled');
              return (
                <li key={s.unit.key} className={styles.resultRow}>
                  <span>
                    {title}
                    {summary.year && ` (${summary.year})`}
                  </span>
                  <button
                    type="button"
                    className={`${button.button} ${button.small}`}
                    onClick={() => void merge(s)}
                  >
                    {t('screening.duplicate.merge')}
                    <span className="visually-hidden">{` – ${title}`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

/** Audit trail of the unit: every decision, including undos and decisions on former units. */
export function HistorySection({
  data,
  screening,
}: {
  data: ScreeningData;
  screening: UnitScreening;
}) {
  const { t, i18n } = useTranslation();
  const describe = useDescribe(data);
  const stageName = (stage: Decision['stage']) =>
    stage === 'pre_screening' ? t('screening.removal.heading') : t(`screening.stage.${stage}`);
  return (
    <details className={styles.more}>
      <summary>{t('screening.history.heading', { count: screening.history.length })}</summary>
      {screening.history.length === 0 ? (
        <p className={styles.muted}>{t('screening.history.empty')}</p>
      ) : (
        <ol className={styles.history}>
          {screening.history.map((d) => (
            <li key={d.id}>
              <time dateTime={d.timestamp}>{formatDateTime(d.timestamp, i18n.language)}</time>
              {' · '}
              {stageName(d.stage)}: {describe(d)}
              {d.note && ` – ${t('screening.history.note', { note: d.note })}`}
              {d.undoOf && ` (${t('screening.history.undo')})`}
              {!screening.unit.memberIds.includes(d.shownRecordId) && (
                <>
                  {' '}
                  (
                  {t('screening.history.otherRecord', {
                    title: recordSummary(data.records.get(d.shownRecordId)).title,
                  })}
                  )
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

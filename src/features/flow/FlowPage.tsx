import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { screeningPaths } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import { readPreference, writePreference } from '../../app/preferences';
import { nowIso, todayLocal } from '../../app/runtime';
import { db } from '../../db/db';
import { saveFlowOverrides } from '../../db/flowRepository';
import { listScreeningData } from '../../db/screeningRepository';
import button from '../../design/button.module.css';
import forms from '../../design/forms.module.css';
import notice from '../../design/notice.module.css';
import { SelectField } from '../../design/Field';
import { ToggleGroup } from '../../design/ToggleGroup';
import { computeFlow } from '../../domain/flow/computeFlow';
import { flowCsv } from '../../domain/flow/csv';
import { nText, type FlowLabelKey } from '../../domain/flow/labels';
import type { FlowCheck, FlowCounts } from '../../domain/flow/types';
import { FLOW_VARIANTS, isUpdateVariant } from '../../domain/flow/variant';
import type { FlowVariant, Project } from '../../domain/types';
import i18n, { LANGUAGE_ENDONYMS } from '../../i18n';
import { useProject } from '../project/useProject';
import { recordSummary } from '../screening/display';
import { download, pngBlob, svgDocument } from './exportFlow';
import styles from './Flow.module.css';
import { FlowSvg } from './FlowSvg';
import { flowLayout, type Box, type Target } from './layout';
import { CsvDelimiterField } from '../export/CsvDelimiterField';
import { useCsvDelimiter } from '../export/useCsvDelimiter';

type LabelLanguage = 'en' | 'de';
const LANGUAGE_KEY = 'flow.labels';
const LANGUAGES = (['en', 'de'] as const).map((value) => ({
  value,
  label: LANGUAGE_ENDONYMS[value],
  lang: value,
}));

export default function FlowPage() {
  const { t } = useTranslation();
  const project = useProject();
  const data = useLiveQuery(() => listScreeningData(db, project.id), [project.id]);
  const counts = useMemo(
    () =>
      data?.project
        ? computeFlow({
            ...data,
            project: data.project,
            sourceRuns: data.runs,
            importBatches: data.batches,
            duplicateGroups: data.groups,
          })
        : undefined,
    [data],
  );

  return (
    <>
      <PageHeading title={t('modules.flow.title')} description={t('modules.flow.description')} />
      {!data?.project || !counts ? (
        <p>{t('common.loading')}</p>
      ) : (
        <FlowView project={data.project} counts={counts} data={data} />
      )}
    </>
  );
}

type Data = NonNullable<Awaited<ReturnType<typeof listScreeningData>>>;

function FlowView({ project, counts, data }: { project: Project; counts: FlowCounts; data: Data }) {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<LabelLanguage>(() =>
    readPreference(LANGUAGE_KEY) === 'de' ? 'de' : 'en',
  );
  const [selection, setSelection] = useState<{ title: string; targets: Target[]; boxId: string }>();
  const [message, setMessage] = useState('');
  const drillHeading = useRef<HTMLHeadingElement>(null);
  const [delimiter, setDelimiter] = useCsvDelimiter();

  const fixed = i18n.getFixedT(language);
  const label = (key: FlowLabelKey) => fixed(`flow.diagram.${key}`);
  const workingTranslation = language === 'de';
  const layout = flowLayout(counts, label, { workingTranslation });
  const title = `${t('flow.page.figure')} – ${project.title}`;
  const fileBase = `facet-review-flow-${todayLocal()}`;

  const select = (box: Box, targets = box.targets) => {
    setSelection({ title: box.lines[0]?.text ?? box.id, targets, boxId: box.id });
    requestAnimationFrame(() => drillHeading.current?.focus());
  };
  const backToDiagram = () => {
    const id = selection?.boxId;
    setSelection(undefined);
    requestAnimationFrame(() =>
      document.querySelector<SVGGElement>(`[data-box="${id}"][role="button"]`)?.focus(),
    );
  };

  const exportSvg = async () => {
    download(await svgDocument(layout, title), `${fileBase}.svg`, 'image/svg+xml');
    setMessage(t('flow.page.exported', { format: 'SVG' }));
  };
  const exportPng = async () => {
    const svg = await svgDocument(layout, title);
    download(await pngBlob(svg, layout), `${fileBase}.png`, 'image/png');
    setMessage(t('flow.page.exported', { format: 'PNG' }));
  };
  const exportCsv = () => {
    const csv = flowCsv(counts, label, { workingTranslation, delimiter });
    download(csv, `${fileBase}.csv`, 'text/csv;charset=utf-8');
    setMessage(t('flow.page.exported', { format: 'CSV' }));
  };

  return (
    <div className={styles.page}>
      <Settings
        project={project}
        counts={counts}
        language={language}
        onLanguage={(next) => {
          setLanguage(next);
          writePreference(LANGUAGE_KEY, next);
        }}
      />

      <Checks checks={counts.checks} projectId={project.id} />

      <figure className={styles.figure} aria-labelledby="flow-caption">
        <figcaption id="flow-caption" className={styles.caption}>
          {t('flow.page.caption')}
          {workingTranslation && ` ${t('flow.page.workingTranslation')}`}
        </figcaption>
        <div className={styles.canvas}>
          <FlowSvg
            layout={layout}
            palette="screen"
            title={title}
            onSelect={(box) => select(box)}
            boxLabel={(box) => `${box.label} – ${t('flow.page.showRecords')}`}
          />
        </div>
      </figure>

      <div className={styles.actions}>
        <button type="button" className={button.button} onClick={() => void exportSvg()}>
          {t('flow.page.exportSvg')}
        </button>
        <button type="button" className={button.button} onClick={() => void exportPng()}>
          {t('flow.page.exportPng')}
        </button>
        <button type="button" className={button.button} onClick={exportCsv}>
          {t('flow.page.exportCsv')}
        </button>
      </div>
      <div className={styles.delimiter}>
        <CsvDelimiterField id="flow-csv-delimiter" value={delimiter} onChange={setDelimiter} />
      </div>
      <p role="status" className={message ? notice.notice : 'visually-hidden'}>
        {message}
      </p>

      {selection && (
        <section aria-labelledby="drill-heading" className={styles.drill}>
          <h2 id="drill-heading" ref={drillHeading} tabIndex={-1}>
            {t('flow.page.drillHeading', { box: selection.title })}
          </h2>
          {selection.targets.map((target) => (
            <DrillList key={target.key} target={target} data={data} projectId={project.id} />
          ))}
          <button type="button" className={button.button} onClick={backToDiagram}>
            {t('flow.page.backToDiagram')}
          </button>
        </section>
      )}

      <section aria-labelledby="flow-table" className={styles.section}>
        <h2 id="flow-table">{t('flow.page.tableHeading')}</h2>
        <p className={styles.muted}>{t('flow.page.tableHint')}</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('flow.page.columnBox')}</th>
                <th scope="col">{t('flow.page.columnN')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('flow.page.columnRecords')}</span>
                </th>
              </tr>
            </thead>
            {layout.boxes.map((box) => (
              <tbody key={box.id}>
                <tr>
                  <th scope="rowgroup" colSpan={3} className={styles.groupRow}>
                    {box.lines[0]?.text}
                  </th>
                </tr>
                {box.targets.length > 0 ? (
                  box.targets.map((target) => (
                    <tr key={target.key}>
                      <th scope="row">{target.label}</th>
                      <td className={styles.number}>{target.count.n}</td>
                      <td>
                        <button
                          type="button"
                          className={`${button.button} ${button.small}`}
                          onClick={() => select(box, [target])}
                        >
                          {t('flow.page.showRecords')}
                          <span className="visually-hidden">{` – ${target.label}`}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <th scope="row" colSpan={3}>
                      {box.label}
                    </th>
                  </tr>
                )}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  );
}

function Settings({
  project,
  counts,
  language,
  onLanguage,
}: {
  project: Project;
  counts: FlowCounts;
  language: LabelLanguage;
  onLanguage: (language: LabelLanguage) => void;
}) {
  const { t } = useTranslation();
  const overrides = project.flowOverrides ?? {};
  const save = (next: Project['flowOverrides']) =>
    saveFlowOverrides(db, project.id, { ...overrides, ...next }, nowIso());
  const update = isUpdateVariant(counts.variant);

  return (
    <section aria-labelledby="flow-settings" className={styles.settings}>
      <h2 id="flow-settings" className="visually-hidden">
        {t('flow.page.settings')}
      </h2>
      <SelectField<FlowVariant | 'auto'>
        id="flow-variant"
        label={t('flow.page.variant')}
        hint={t('flow.page.detected', { variant: t(`flow.variant.${counts.detectedVariant}`) })}
        value={overrides.variant ?? 'auto'}
        options={[
          { value: 'auto', label: t('flow.page.auto') },
          ...FLOW_VARIANTS.map((variant) => ({
            value: variant,
            label: t(`flow.variant.${variant}`),
          })),
        ]}
        onChange={(value) => void save({ variant: value === 'auto' ? undefined : value })}
      />
      <ToggleGroup
        label={t('flow.page.labelLanguage')}
        options={LANGUAGES}
        value={language}
        onChange={onLanguage}
      />
      {language === 'de' && <p className={forms.hint}>{t('flow.page.workingTranslation')}</p>}
      {update && (
        <fieldset className={forms.fieldset}>
          <legend className={forms.legend}>{t('flow.page.previous')}</legend>
          <p className={forms.hint}>{t('flow.page.previousHint')}</p>
          <div className={forms.grid2}>
            <ManualNumber
              id="previous-studies"
              label={t('flow.page.previousStudies')}
              value={overrides.previousStudies}
              onSave={(previousStudies) => void save({ previousStudies })}
            />
            <ManualNumber
              id="previous-reports"
              label={t('flow.page.previousReports')}
              value={overrides.previousReports}
              onSave={(previousReports) => void save({ previousReports })}
            />
          </div>
        </fieldset>
      )}
    </section>
  );
}

function ManualNumber({
  id,
  label,
  value,
  onSave,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onSave: (value: number | undefined) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  const parsed = draft.trim() === '' ? undefined : Number(draft);
  const invalid = parsed !== undefined && (!Number.isInteger(parsed) || parsed < 0);
  return (
    <div className={forms.field}>
      <label htmlFor={id} className={forms.label}>
        {label}
      </label>
      <input
        id={id}
        className={forms.input}
        inputMode="numeric"
        autoComplete="off"
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (!invalid && parsed !== value) onSave(parsed);
        }}
      />
      {invalid && (
        <p id={`${id}-error`} className={forms.error}>
          {t('validation.invalidNumber')}
        </p>
      )}
    </div>
  );
}

function Checks({ checks, projectId }: { checks: FlowCheck[]; projectId: string }) {
  const { t } = useTranslation();
  const problems = checks.filter((check) => check.status !== 'ok');
  if (problems.length === 0) {
    return <p className={notice.notice}>{t('flow.page.checksOk')}</p>;
  }
  return (
    <div
      className={`${notice.notice} ${problems.some((c) => c.status === 'error') ? notice.error : notice.warning}`}
    >
      <h2>{t('flow.page.checksHeading')}</h2>
      <ul>
        {problems.map((check) => (
          <li key={`${check.column}-${check.id}`}>
            {check.status === 'incomplete'
              ? t(`flow.check.incomplete.${check.id}`, {
                  count: check.open,
                  column: t(`flow.check.column.${check.column}`),
                })
              : t('flow.check.error', {
                  check: t(`flow.check.name.${check.id}`),
                  total: check.total,
                  sum: check.parts.reduce((a, b) => a + b, 0) + check.open,
                })}{' '}
            {check.status === 'incomplete' &&
              (check.id === 'screening' || check.id === 'eligibility') && (
                <Link
                  to={screeningPaths.page(
                    projectId,
                    check.id === 'screening' ? 'title-abstract' : 'full-text',
                    'open',
                  )}
                >
                  {t('flow.check.toScreening')}
                </Link>
              )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const DRILL_LIMIT = 200;

function DrillList({ target, data, projectId }: { target: Target; data: Data; projectId: string }) {
  const { t } = useTranslation();
  const records = new Map(data.records.map((record) => [record.id, record]));
  const [all, setAll] = useState(false);
  const ids = all ? target.count.recordIds : target.count.recordIds.slice(0, DRILL_LIMIT);
  return (
    <div className={styles.drillGroup}>
      <h3>{`${target.label} ${nText(target.count.n)}`}</h3>
      {target.count.n === 0 ? (
        <p className={styles.muted}>{t('flow.page.none')}</p>
      ) : (
        <ul className={styles.drillList}>
          {ids.map((id) => {
            const summary = recordSummary(records.get(id));
            return (
              <li key={id}>
                <Link to={screeningPaths.unit(projectId, 'title-abstract', id)}>
                  {summary.title || t('screening.untitled')}
                </Link>
                {(summary.firstAuthor || summary.year) && (
                  <span className={styles.muted}>
                    {' – '}
                    {[summary.firstAuthor, summary.year].filter(Boolean).join(' ')}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!all && target.count.n > DRILL_LIMIT && (
        <button
          type="button"
          className={`${button.button} ${button.small}`}
          onClick={() => setAll(true)}
        >
          {t('flow.page.showAll', { count: target.count.n })}
        </button>
      )}
    </div>
  );
}

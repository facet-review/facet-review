import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { db } from '../../db/db';
import { saveSource } from '../../db/searchRepository';
import { createSource, pruneSource } from '../../domain/search/createSearch';
import {
  SOURCE_TYPE_CONFIG,
  SOURCE_TYPES,
  type SourceField,
} from '../../domain/search/sourceTypes';
import { hasErrors, validateSource, type SourceIssue } from '../../domain/search/validateSearch';
import type { Source } from '../../domain/types';
import { moveItem, removeAt, updateAt } from '../../domain/util/list';
import NotFoundPage from '../../app/NotFoundPage';
import { searchPaths } from '../../app/modules';
import { PageHeading } from '../../app/PageHeading';
import { newId, nowIso } from '../../app/runtime';
import button from '../../design/button.module.css';
import { EditableList } from '../../design/EditableList';
import { ErrorSummary } from '../../design/ErrorSummary';
import { SelectField, TextField } from '../../design/Field';
import forms from '../../design/forms.module.css';
import { useProject } from '../project/useProject';
import { UnsavedChangesGuard } from './UnsavedChangesGuard';
import { useNavigateAfterSave } from './useNavigateAfterSave';

/** Add or edit a source; `sourceId` absent = new. */
export default function SourceFormPage() {
  const project = useProject();
  const { sourceId } = useParams();
  const existing = useLiveQuery(
    async () => (sourceId ? ((await db.sources.get(sourceId)) ?? null) : undefined),
    [sourceId],
  );
  // Created once per page visit: a new id on every render would remount the form.
  const [blank] = useState(() =>
    createSource({ projectId: project.id, type: 'database', name: '' }, newId),
  );
  if (sourceId && existing === undefined) return null; // loading
  if (existing === null || (existing && existing.projectId !== project.id)) return <NotFoundPage />;
  const initial = existing ?? blank;
  return <SourceForm key={initial.id} initial={initial} isNew={!existing} />;
}

function SourceForm({ initial, isNew }: { initial: Source; isNew: boolean }) {
  const { t } = useTranslation();
  const { saved, leaveTo } = useNavigateAfterSave();
  const [draft, setDraft] = useState<Source>(initial);
  const [submitted, setSubmitted] = useState(false);
  const config = SOURCE_TYPE_CONFIG[draft.type];
  const shows = (field: SourceField) => config.sourceFields.includes(field);
  const required = (field: SourceField) => config.requiredSourceFields.includes(field);
  const pruned = pruneSource(draft);
  const issues = validateSource(pruned);
  const dirty = !saved && JSON.stringify(pruned) !== JSON.stringify(pruneSource(initial));

  const errorFor = (field: SourceField) => {
    const issue = submitted ? issues.find((i) => i.field === field) : undefined;
    return issue ? t(`validation.${issue.code}`) : undefined;
  };
  const labelFor = (field: SourceField) =>
    field === 'name'
      ? t('sourceForm.name')
      : field === 'platform'
        ? t('sourceForm.platform')
        : field === 'url'
          ? t('sourceForm.url')
          : t('sourceForm.databases');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(issues)) return;
    await saveSource(db, pruned, nowIso());
    leaveTo(
      isNew ? searchPaths.newRun(pruned.projectId, pruned.id) : searchPaths.page(pruned.projectId),
    );
  }

  const set = (patch: Partial<Source>) => setDraft((current) => ({ ...current, ...patch }));
  const databases = draft.databases ?? [];
  const setDatabases = (next: string[]) => set({ databases: next });

  return (
    <>
      <PageHeading title={t(isNew ? 'sourceForm.newTitle' : 'sourceForm.editTitle')} />
      {submitted && (
        <ErrorSummary
          title={t('form.errorSummary')}
          items={issues.map((issue: SourceIssue) => ({
            target: `source-${issue.field}`,
            message: `${labelFor(issue.field)}: ${t(`validation.${issue.code}`)}`,
          }))}
        />
      )}
      <form className={forms.section} noValidate onSubmit={(event) => void submit(event)}>
        <SelectField
          id="source-type"
          label={t('sourceForm.type')}
          hint={t(`sourceTypes.${draft.type}.hint`)}
          value={draft.type}
          options={SOURCE_TYPES.map((type) => ({
            value: type,
            label: `${t(`sourceTypes.${type}.label`)} (${t('search.prismaS', {
              items: SOURCE_TYPE_CONFIG[type].prismaS.join(', '),
            })})`,
          }))}
          onChange={(type) => set({ type })}
        />
        <TextField
          id="source-name"
          label={t('sourceForm.name')}
          hint={t(`sourceForm.nameHint.${draft.type}`)}
          required
          value={draft.name}
          error={errorFor('name')}
          onChange={(name) => set({ name })}
        />
        {shows('platform') && (
          <TextField
            id="source-platform"
            label={t('sourceForm.platform')}
            hint={t('sourceForm.platformHint')}
            required={required('platform')}
            value={draft.platform ?? ''}
            error={errorFor('platform')}
            onChange={(platform) => set({ platform })}
          />
        )}
        {shows('databases') && (
          <EditableList
            label={t('sourceForm.databases')}
            hint={t('sourceForm.databasesHint')}
            items={databases.map((value, index) => ({ key: String(index), value }))}
            itemLabel={(n) => t('sourceForm.databaseItem', { n })}
            addLabel={t('sourceForm.addDatabase')}
            onChange={(index, value) => setDatabases(updateAt(databases, index, value))}
            onAdd={() => setDatabases([...databases, ''])}
            onRemove={(index) => setDatabases(removeAt(databases, index))}
            onMove={(index, direction) =>
              setDatabases(moveItem(databases, index, index + direction))
            }
          />
        )}
        {shows('url') && (
          <TextField
            id="source-url"
            label={t('sourceForm.url')}
            hint={t('project.fields.urlHint')}
            type="url"
            required={required('url')}
            value={draft.url ?? ''}
            error={errorFor('url')}
            onChange={(url) => set({ url })}
          />
        )}
        <div className={forms.actions}>
          <button type="submit" className={`${button.button} ${button.primary}`}>
            {t(isNew ? 'sourceForm.submitNew' : 'common.save')}
          </button>
          <Link to={searchPaths.page(draft.projectId)} className={button.button}>
            {t('common.cancel')}
          </Link>
        </div>
      </form>
      <UnsavedChangesGuard when={dirty} />
    </>
  );
}

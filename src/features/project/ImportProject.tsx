import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../../db/db';
import { getProject, importBundle } from '../../db/projectRepository';
import { requestPersistentStorage } from '../../db/persistence';
import type { ImportIssue } from '../../domain/exchange/issues';
import { parseProjectFile } from '../../domain/exchange/projectFile';
import { remapIds } from '../../domain/exchange/remapIds';
import type { ProjectBundle } from '../../domain/types';
import { newId } from '../../app/runtime';
import button from '../../design/button.module.css';
import notice from '../../design/notice.module.css';
import { ConfirmDialog } from '../../design/ConfirmDialog';

interface ImportProjectProps {
  onImported: (title: string) => void;
  /** Button text; defaults to "import project (JSON)". */
  label?: string;
  className?: string;
}

export function ImportProject({ onImported, label, className }: ImportProjectProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [conflict, setConflict] = useState<{ bundle: ProjectBundle; existingTitle: string }>();

  async function store(bundle: ProjectBundle, mode: 'new' | 'replace') {
    await importBundle(db, bundle, mode);
    await requestPersistentStorage();
    onImported(bundle.project.title);
  }

  async function handleFile(file: File) {
    setIssues([]);
    const result = parseProjectFile(await file.text());
    if (!result.ok) {
      setIssues(result.errors);
      return;
    }
    const existing = await getProject(db, result.value.project.id);
    if (existing) {
      setConflict({ bundle: result.value, existingTitle: existing.title });
      return;
    }
    await store(result.value, 'new');
  }

  async function resolve(choice: 'replace' | 'copy') {
    if (!conflict) return;
    const { bundle } = conflict;
    setConflict(undefined);
    if (choice === 'replace') {
      await store(bundle, 'replace');
    } else {
      const copy = remapIds(bundle, newId);
      copy.project.title = `${copy.project.title}${t('importFile.copySuffix')}`;
      await store(copy, 'new');
    }
  }

  return (
    <>
      <button
        type="button"
        className={className ?? button.button}
        onClick={() => input.current?.click()}
      >
        {label ?? t('overview.importProject')}
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="import-project-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // allow choosing the same file again
          if (file) void handleFile(file);
        }}
      />
      {issues.length > 0 && (
        <div role="alert" className={`${notice.notice} ${notice.error}`}>
          <h2>{t('importFile.errorTitle')}</h2>
          <ul>
            {issues.map((issue, index) => (
              <li key={index}>
                {t(`importFile.errors.${issue.code}`, { path: issue.path, detail: issue.detail })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ConfirmDialog
        open={conflict !== undefined}
        title={t('importFile.conflictTitle')}
        onCancel={() => setConflict(undefined)}
        actions={[
          { label: t('importFile.copy'), onSelect: () => void resolve('copy'), variant: 'primary' },
          {
            label: t('importFile.replace'),
            onSelect: () => void resolve('replace'),
            variant: 'danger',
          },
        ]}
      >
        <p>{t('importFile.conflictBody', { title: conflict?.existingTitle ?? '' })}</p>
      </ConfirmDialog>
    </>
  );
}

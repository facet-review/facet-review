import { db } from '../../db/db';
import { loadBundle, markExported } from '../../db/projectRepository';
import { serializeProjectFile } from '../../domain/exchange/projectFile';
import { exportFileName } from '../../domain/util/slug';
import { APP_VERSION, nowIso } from '../../app/runtime';

function downloadText(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exports the complete project as JSON and records the backup. Local only – nothing is uploaded. */
export async function exportProject(projectId: string): Promise<void> {
  const bundle = await loadBundle(db, projectId);
  if (!bundle) return;
  const exportedAt = nowIso();
  const file = serializeProjectFile(bundle, { exportedAt, appVersion: APP_VERSION });
  downloadText(
    JSON.stringify(file, null, 2),
    exportFileName(bundle.project.title, exportedAt),
    'application/json',
  );
  await markExported(db, projectId, exportedAt);
}

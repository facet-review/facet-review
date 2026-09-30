import type { ISODate, Project } from '../types';

export const BACKUP_REMINDER_DAYS = 7;
export const BACKUP_REMINDER_CHANGES = 50;

const DAY_MS = 86_400_000;

/**
 * Browser storage can be cleared, so users are reminded to export a JSON backup
 * after 50 changes or 7 days (counted from the last export, or from creation).
 */
export function needsBackupReminder(
  project: Pick<Project, 'createdAt' | 'backup'>,
  now: ISODate,
): boolean {
  const { changesSinceExport, lastExportedAt } = project.backup;
  if (changesSinceExport <= 0) return false;
  if (changesSinceExport >= BACKUP_REMINDER_CHANGES) return true;
  const since = Date.parse(lastExportedAt ?? project.createdAt);
  return Date.parse(now) - since >= BACKUP_REMINDER_DAYS * DAY_MS;
}

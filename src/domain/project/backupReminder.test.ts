import { describe, expect, it } from 'vitest';
import {
  BACKUP_REMINDER_CHANGES,
  BACKUP_REMINDER_DAYS,
  needsBackupReminder,
} from './backupReminder';

const createdAt = '2026-09-01T00:00:00.000Z';
const day = (n: number) => new Date(Date.parse(createdAt) + n * 86_400_000).toISOString();

describe('needsBackupReminder', () => {
  it('uses 7 days and 50 changes as thresholds', () => {
    expect(BACKUP_REMINDER_DAYS).toBe(7);
    expect(BACKUP_REMINDER_CHANGES).toBe(50);
  });

  it('stays quiet without unsaved changes', () => {
    expect(needsBackupReminder({ createdAt, backup: { changesSinceExport: 0 } }, day(30))).toBe(
      false,
    );
  });

  it('reminds after 50 changes regardless of time', () => {
    expect(needsBackupReminder({ createdAt, backup: { changesSinceExport: 49 } }, day(1))).toBe(
      false,
    );
    expect(needsBackupReminder({ createdAt, backup: { changesSinceExport: 50 } }, day(1))).toBe(
      true,
    );
  });

  it('reminds 7 days after creation if never exported', () => {
    const project = { createdAt, backup: { changesSinceExport: 1 } };
    expect(needsBackupReminder(project, day(6))).toBe(false);
    expect(needsBackupReminder(project, day(7))).toBe(true);
  });

  it('counts days from the last export once there is one', () => {
    const project = { createdAt, backup: { lastExportedAt: day(10), changesSinceExport: 3 } };
    expect(needsBackupReminder(project, day(16))).toBe(false);
    expect(needsBackupReminder(project, day(17))).toBe(true);
  });
});

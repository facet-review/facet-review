/** Problems found while reading a project file. The UI translates `code`. */
export interface ImportIssue {
  code:
    | 'invalidJson'
    | 'notAnObject'
    | 'wrongFormat'
    | 'invalidSchemaVersion'
    | 'unsupportedFutureVersion'
    | 'missingMigration'
    | 'invalidField';
  /** JSON path of the offending value, e.g. `project.exclusionReasons[0].order`. */
  path?: string;
  detail?: string;
}

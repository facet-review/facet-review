import { useTranslation } from 'react-i18next';
import { SelectField } from '../../design/Field';
import type { CsvDelimiter } from '../../domain/export/csv';

const NAMES: Record<CsvDelimiter, 'semicolon' | 'comma' | 'tab'> = {
  ';': 'semicolon',
  ',': 'comma',
  '\t': 'tab',
};

export function CsvDelimiterField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: CsvDelimiter;
  onChange: (value: CsvDelimiter) => void;
}) {
  const { t } = useTranslation();
  return (
    <SelectField<CsvDelimiter>
      id={id}
      label={t('export.delimiter.label')}
      hint={t('export.delimiter.hint')}
      value={value}
      options={(Object.keys(NAMES) as CsvDelimiter[]).map((d) => ({
        value: d,
        label: t(`export.delimiter.${NAMES[d]}`),
      }))}
      onChange={onChange}
    />
  );
}

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ChecklistDocumentRow } from '../../../domain/checklist/document';
import {
  limitsText,
  type AppendixLabels,
  type SearchAppendix,
} from '../../../domain/export/searchAppendix';

/**
 * PDF documents (react-pdf). This module is loaded on demand only – the
 * library stays out of the main bundle. Fonts come from the locally bundled
 * IBM Plex Sans files (no CDN).
 */

const FAMILY = 'IBM Plex Sans';

const INK = '#1a1d1e';
const MUTED = '#4a5356';
const LINE = '#6b7477';
const SHADE = '#e8eced';

const styles = StyleSheet.create({
  page: { fontFamily: FAMILY, fontSize: 9, color: INK, padding: 36, paddingBottom: 60 },
  title: { fontSize: 14, fontWeight: 600, marginBottom: 2 },
  subtitle: { fontSize: 9, color: MUTED, marginBottom: 10 },
  notice: { fontSize: 8, fontStyle: 'italic', color: MUTED, marginBottom: 8 },
  table: { borderTop: `1pt solid ${LINE}`, borderLeft: `1pt solid ${LINE}` },
  row: { flexDirection: 'row' },
  cell: { borderRight: `1pt solid ${LINE}`, borderBottom: `1pt solid ${LINE}`, padding: 4 },
  head: { fontWeight: 600, backgroundColor: SHADE },
  section: { fontWeight: 600, backgroundColor: SHADE, padding: 4 },
  footer: {
    position: 'absolute',
    left: 36,
    right: 36,
    bottom: 20,
    fontSize: 7,
    color: MUTED,
  },
  h2: { fontSize: 12, fontWeight: 600, marginTop: 12, marginBottom: 4 },
  h3: { fontSize: 10, fontWeight: 600, marginTop: 8, marginBottom: 2 },
  h4: { fontSize: 9, fontWeight: 600, marginTop: 6, marginBottom: 2 },
  item: { marginBottom: 1 },
  code: {
    marginTop: 3,
    padding: 5,
    border: `1pt solid ${LINE}`,
    backgroundColor: '#f4f5f5',
    fontSize: 8,
  },
});

// Column widths of the official checklist table.
const columns = StyleSheet.create({
  topic: { width: '18%' },
  id: { width: '7%' },
  text: { width: '50%' },
  location: { width: '25%' },
});
const COLUMN_STYLES = [columns.topic, columns.id, columns.text, columns.location];
const META_KEYS = ['filters', 'priorWork', 'updates', 'peerReview'] as const;

export interface ChecklistPdfProps {
  title: string;
  subtitle: string;
  columns: [string, string, string, string];
  sections: { section: string; rows: ChecklistDocumentRow[] }[];
  notice?: string;
  footer: string[];
  language: string;
  pageLabel: (page: number, total: number) => string;
}

/** Layout of the official checklist: landscape, four columns, section rows. */
export function ChecklistPdf(props: ChecklistPdfProps) {
  const cell = (index: number) => [styles.cell, COLUMN_STYLES[index]!];
  return (
    <Document
      title={props.title}
      subject={props.subtitle}
      author="Facet Review"
      language={props.language}
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{props.title}</Text>
        <Text style={styles.subtitle}>{props.subtitle}</Text>
        {props.notice && <Text style={styles.notice}>{props.notice}</Text>}
        <View style={styles.table}>
          <View style={[styles.row, styles.head]} fixed>
            {props.columns.map((column, index) => (
              <Text key={column} style={cell(index)}>
                {column}
              </Text>
            ))}
          </View>
          {props.sections.map((section) => (
            <View key={section.section}>
              <View style={styles.row} wrap={false}>
                <Text style={[styles.cell, styles.section, { width: '100%' }]}>
                  {section.section}
                </Text>
              </View>
              {section.rows.map((row) => (
                <View key={row.id} style={styles.row} wrap={false}>
                  <Text style={cell(0)}>{row.showTopic ? row.topic : ''}</Text>
                  <Text style={cell(1)}>{row.id}</Text>
                  <Text style={cell(2)}>{row.text}</Text>
                  <Text style={cell(3)}>{row.location}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <Footer lines={props.footer} pageLabel={props.pageLabel} />
      </Page>
    </Document>
  );
}

function Footer({
  lines,
  pageLabel,
}: {
  lines: string[];
  pageLabel: (page: number, total: number) => string;
}) {
  return (
    <View style={styles.footer} fixed>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
      <Text render={({ pageNumber, totalPages }) => pageLabel(pageNumber, totalPages)} />
    </View>
  );
}

export interface AppendixPdfProps {
  model: SearchAppendix;
  label: AppendixLabels;
  footer: string[];
  language: string;
  pageLabel: (page: number, total: number) => string;
}

/** PRISMA-S search appendix: every source, every run, the full search strings. */
export function AppendixPdf({ model, label, footer, language, pageLabel }: AppendixPdfProps) {
  const item = (name: string, value: string | number | undefined) =>
    value === undefined || value === '' ? null : (
      <Text key={name} style={styles.item}>
        {`${name}: ${value}`}
      </Text>
    );
  const title = `${label('heading')}: ${model.projectTitle}`;
  return (
    <Document title={title} author="Facet Review" language={language}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {model.groups.map((group) => (
          <View key={group.type}>
            <Text style={styles.h2}>{label(`type.${group.type}`)}</Text>
            {group.sources.map((source) => (
              <View key={source.label}>
                <Text style={styles.h3}>{source.label}</Text>
                {item(label('platform'), source.platform)}
                {item(label('url'), source.url)}
                {source.runs.map((run, index) => (
                  <View key={index}>
                    <Text style={styles.h4}>{`${label('run')} ${index + 1}`}</Text>
                    {item(label('date'), run.dateTo ? `${run.date} – ${run.dateTo}` : run.date)}
                    {run.limits && item(label('limits'), limitsText(run.limits, label))}
                    {item(label('reportedHits'), run.reportedHits)}
                    {item(label('imported'), run.imported)}
                    {item(label('importNote'), run.importNote)}
                    {item(label('tool'), run.tool)}
                    {item(label('method'), run.method && label(`method.${run.method}`))}
                    {item(label('recordsChecked'), run.recordsChecked)}
                    {item(
                      label('citationDirection'),
                      run.citationDirection && label(`direction.${run.citationDirection}`),
                    )}
                    {item(label('seedDocuments'), run.seedDocuments)}
                    {item(label('description'), run.description)}
                    {item(label('notes'), run.notes)}
                    {run.searchString && (
                      <View>
                        <Text style={styles.item}>{`${label('searchString')}:`}</Text>
                        <Text style={styles.code}>{run.searchString}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
        {META_KEYS.some((key) => model.searchMeta[key]) && (
          <View>
            <Text style={styles.h2}>{label('projectWide')}</Text>
            {META_KEYS.map((key) => item(label(key), model.searchMeta[key]))}
          </View>
        )}
        <Footer lines={footer} pageLabel={pageLabel} />
      </Page>
    </Document>
  );
}

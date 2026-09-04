import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT_FAMILY } from './fonts';
import type { SelectorResult } from '@/lib/selector/types';

export type ReportLabels = {
  title: string;
  task: string;
  generatedAt: string;
  generatedFor: string;
  inputs: string;
  result: string;
  camera: string;
  lighting: string;
  lens: string;
  processing: string;
  accessories: string;
  approach: string;
  approachReason: string;
  calculations: string;
  notes: string;
  notSpecified: string;
  disclaimer: string;
  page: string;
};

export type ReportData = {
  taskName: string;
  userEmail: string;
  createdAt: string;
  inputs: { label: string; value: string }[];
  result: SelectorResult;
  approachLabel: string;
  metricLabels: Record<string, string>;
  locale: 'vi' | 'en';
};

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    lineHeight: 1.5,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    color: '#0f172a',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#0284c7',
    paddingBottom: 10,
    marginBottom: 18,
  },
  title: { fontSize: 18, fontWeight: 700 },
  taskName: { fontSize: 12, marginTop: 4, color: '#334155' },
  meta: { fontSize: 8, color: '#64748b', marginTop: 6 },

  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    color: '#0369a1',
  },

  row: { flexDirection: 'row', paddingVertical: 3 },
  rowAlt: { flexDirection: 'row', paddingVertical: 3, backgroundColor: '#f8fafc' },
  cellLabel: { width: '38%', color: '#475569', paddingRight: 8 },
  cellValue: { width: '62%' },

  approachBadge: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#e0f2fe',
    color: '#075985',
    fontWeight: 700,
    alignSelf: 'flex-start',
  },

  formulaBox: {
    backgroundColor: '#f1f5f9',
    padding: 6,
    marginTop: 2,
    marginBottom: 6,
    fontSize: 9,
  },
  metricLabel: { fontWeight: 700, fontSize: 9 },

  note: { marginBottom: 7 },
  noteCode: { fontSize: 8, color: '#94a3b8', marginTop: 1 },

  disclaimer: {
    marginTop: 22,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    fontSize: 8,
    color: '#64748b',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 28,
    left: 44,
    right: 44,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  },
});

export function SelectorReport({ data, labels }: { data: ReportData; labels: ReportLabels }) {
  const { result } = data;
  const pick = (note: { vi: string; en: string }) => (data.locale === 'en' ? note.en : note.vi);

  const outputs = [
    { label: labels.lighting, value: result.lighting },
    { label: labels.lens, value: result.lens },
    { label: labels.camera, value: result.camera },
    { label: labels.processing, value: result.processing },
    { label: labels.accessories, value: result.accessories },
  ];

  return (
    <Document title={`${labels.title} — ${data.taskName}`} author="Machine Vision Hub">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{labels.title}</Text>
          <Text style={styles.taskName}>
            {labels.task}: {data.taskName}
          </Text>
          <Text style={styles.meta}>
            {labels.generatedAt}: {data.createdAt} · {labels.generatedFor}: {data.userEmail}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.inputs}</Text>
          {data.inputs.map((input, index) => (
            <View key={input.label} style={index % 2 === 0 ? styles.row : styles.rowAlt}>
              <Text style={styles.cellLabel}>{input.label}</Text>
              <Text style={styles.cellValue}>{input.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{labels.result}</Text>
          {outputs.map((output, index) => (
            <View key={output.label} style={index % 2 === 0 ? styles.row : styles.rowAlt}>
              <Text style={styles.cellLabel}>{output.label}</Text>
              <Text style={styles.cellValue}>{output.value ?? labels.notSpecified}</Text>
            </View>
          ))}

          <Text style={styles.approachBadge}>
            {labels.approach}: {data.approachLabel}
          </Text>

          {result.approachReason ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.metricLabel}>{labels.approachReason}</Text>
              <Text>{pick(result.approachReason)}</Text>
            </View>
          ) : null}
        </View>

        {result.derived.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.calculations}</Text>
            {result.derived.map((metric) => (
              <View key={metric.key} wrap={false}>
                <Text style={styles.metricLabel}>
                  {data.metricLabels[metric.key] ?? metric.key}
                </Text>
                <Text style={styles.formulaBox}>{metric.formula}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {result.notes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{labels.notes}</Text>
            {result.notes.map((note, index) => (
              <View key={`${note.ruleCode ?? 'note'}-${index}`} style={styles.note} wrap={false}>
                <Text>• {pick(note)}</Text>
                {note.ruleCode ? <Text style={styles.noteCode}>{note.ruleCode}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.disclaimer}>{labels.disclaimer}</Text>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `${labels.page} ${pageNumber}/${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

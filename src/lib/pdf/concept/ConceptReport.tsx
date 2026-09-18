import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ConceptDocument, Translate } from '@/lib/export/conceptDocument';
import { PDF_FONT_FAMILY } from '../family';

/**
 * Concept Report — V1c mục C6 (spec V1.1 §11.1). Gửi khách hàng được ngay.
 *
 * Thứ tự: Yêu cầu → Giả định → Phân tích kỹ thuật → Kiến trúc → BOM → Khả thi →
 * Cảnh báo → Kế hoạch xác nhận, rồi trang riêng Giả định & Loại trừ (bắt buộc —
 * bảo vệ phòng khi khách đổi yêu cầu).
 *
 * KHÔNG ghi giá (chốt Q4): đây là tài liệu kỹ thuật gửi khách, báo giá đi riêng.
 *
 * Thư mục này có package.json "type": "module": @react-pdf/renderer chỉ chạy ở
 * ESM, còn tsx dịch file .tsx thường sang CJS — test (test-export-pdf.mts) sẽ
 * vỡ ở require('@react-pdf/hyphenate/en-us'). Next đóng gói ESM nên không bị.
 */

/**
 * Ký hiệu Be Vietnam Pro không có glyph (kiểm bằng fontkit). Để nguyên thì
 * react-pdf rơi về Helvetica — cũng không có — và chữ thành ô trống. Đổi sang
 * ký tự tương đương CÓ trong font; test-export-pdf.mts chặn Helvetica.
 */
const PDF_REPLACEMENTS: Record<string, string> = {
  '→': '->',
  '↔': '<->',
  '∉': 'không thuộc',
  '∈': 'thuộc',
  '√': 'sqrt',
  '⌈': 'ceil(',
  '⌉': ')',
  '─': '-',
  '①': '(1)',
  '②': '(2)',
  '✓': '(v)',
  '⛔': '(!)',
  // Chữ Hy Lạp trong công thức: Δh / ΔT viết theo lối kỹ thuật dh / dT.
  'β': 'beta',
  'α': 'alpha',
  'Δ': 'd',
  'λ': 'lambda',
  'θ': 'theta',
};
const UNSUPPORTED = new RegExp(`[${Object.keys(PDF_REPLACEMENTS).join('')}]`, 'gu');
export const pdfSafeText = (text: string) => text.replace(UNSUPPORTED, (ch) => PDF_REPLACEMENTS[ch]);

function pdfSafe<T>(value: T): T {
  if (typeof value === 'string') return pdfSafeText(value) as T;
  if (Array.isArray(value)) return value.map(pdfSafe) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pdfSafe(v)])) as T;
  return value;
}

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 9.5, lineHeight: 1.45, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, color: '#0f172a' },
  header: { borderBottomWidth: 2, borderBottomColor: '#0284c7', paddingBottom: 10, marginBottom: 14 },
  // lineHeight riêng: kế thừa 1,45 của trang thì dòng 18 pt có dấu đè lên dòng dưới.
  title: { fontSize: 18, fontWeight: 700, lineHeight: 1.3 },
  subtitle: { fontSize: 11, marginTop: 6, color: '#334155', lineHeight: 1.3 },
  meta: { fontSize: 8, color: '#64748b', marginTop: 5 },
  banner: { marginTop: 8, padding: 6, backgroundColor: '#fef3c7', color: '#92400e', fontSize: 8.5 },
  statusBox: { marginTop: 6, padding: 8, borderWidth: 1, borderColor: '#0284c7', backgroundColor: '#f0f9ff' },
  statusText: { fontSize: 12, fontWeight: 700 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 5, color: '#0369a1' },
  subTitle: { fontSize: 9.5, fontWeight: 700, marginTop: 6, marginBottom: 2 },
  row: { flexDirection: 'row', paddingVertical: 2 },
  rowAlt: { flexDirection: 'row', paddingVertical: 2, backgroundColor: '#f8fafc' },
  label: { width: '40%', color: '#475569', paddingRight: 8 },
  value: { width: '60%' },
  assumed: { color: '#b45309' },
  rule: { fontSize: 8, color: '#64748b', width: 48 },
  item: { flexDirection: 'row', marginBottom: 3 },
  itemText: { flex: 1 },
  formula: { fontSize: 8, color: '#334155', backgroundColor: '#f1f5f9', padding: 3, marginTop: 1 },
  note: { fontSize: 8.5, color: '#475569', marginTop: 1 },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#94a3b8', paddingBottom: 2, fontWeight: 700, fontSize: 8.5 },
  td: { flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', fontSize: 8.5 },
  cCat: { width: '17%', paddingRight: 4 },
  cName: { width: '53%', paddingRight: 4 },
  cQty: { width: '8%', textAlign: 'right', paddingRight: 6 },
  cRule: { width: '22%' },
  footnote: { marginTop: 6, fontSize: 8, color: '#b45309' },
  disclaimer: { marginTop: 18, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0', fontSize: 7.5, color: '#64748b' },
  pageNumber: { position: 'absolute', bottom: 28, left: 44, right: 44, textAlign: 'center', fontSize: 7.5, color: '#94a3b8' },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Rows({ rows }: { rows: { label: string; value: string; assumed?: boolean }[] }) {
  return (
    <View>
      {rows.map((row, index) => (
        <View key={`${row.label}-${index}`} style={index % 2 ? styles.rowAlt : styles.row} wrap={false}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={row.assumed ? [styles.value, styles.assumed] : styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function RuleItems({ items }: { items: { ruleId: string; text: string }[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={`${item.ruleId}-${index}`} style={styles.item} wrap={false}>
          <Text style={styles.rule}>{item.ruleId}</Text>
          <Text style={styles.itemText}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

export function ConceptReport({ doc: raw, t: translate }: { doc: ConceptDocument; t: Translate }) {
  const doc = pdfSafe(raw);
  const t: Translate = (key, values) => pdfSafeText(translate(key, values));
  /* Chân trang CỐ ĐỊNH, không có số trang: với bản react-pdf đang dùng, Text có
     prop `render` (số trang động) không được vẽ ra — thử riêng một PDF tối giản
     cũng vậy — còn Text cố định thì vẽ bình thường trên mọi trang. */
  const footer = (
    <Text style={styles.pageNumber} fixed>
      {t('export.footer', { project: doc.projectName, rev: doc.revLabel })}
    </Text>
  );

  return (
    <Document title={`${doc.projectName} — Rev ${doc.revLabel}`} author={doc.author} creator="Machine Vision Hub">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('export.pdf.title')}</Text>
          <Text style={styles.subtitle}>
            {doc.projectName} — Rev {doc.revLabel} · {doc.applicationLabel}
          </Text>
          <Text style={styles.meta}>{t('export.meta', { saved: doc.savedAt, ruleset: doc.rulesetSaved ?? doc.rulesetNow, author: doc.author })}</Text>
          <Text style={styles.meta}>{t('export.generatedAt', { at: doc.generatedAt })}</Text>
          {!doc.locked ? <Text style={styles.banner}>{t('export.draftRevision')}</Text> : null}
          {doc.rulesetChanged ? <Text style={styles.banner}>{t('export.rulesetChanged', { saved: doc.rulesetSaved ?? '', now: doc.rulesetNow })}</Text> : null}
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{doc.feasibility.status}</Text>
          {doc.feasibility.overall !== null ? (
            <Text>
              {t('export.pdf.overall', { score: doc.feasibility.overall })}
              {doc.feasibility.limiting ? ` · ${t('export.pdf.limiting', { factors: doc.feasibility.limiting })}` : ''}
            </Text>
          ) : null}
        </View>

        <Section title={`1. ${t('export.pdf.requirement')}`}>
          <Rows rows={doc.requirement} />
          <Text style={styles.note}>{t('export.pdf.assumedLegend')}</Text>
        </Section>

        <Section title={`2. ${t('designer.requirement.bom.assumptionsTitle')}`}>
          {doc.assumptions.length > 0 ? <Rows rows={doc.assumptions} /> : <Text>{t('designer.requirement.bom.noAssumptions')}</Text>}
        </Section>

        <Section title={`3. ${t('export.pdf.analysis')}`}>
          {doc.analysis.map((group) => (
            <View key={group.dimension}>
              <Text style={styles.subTitle}>{group.dimension}</Text>
              {group.rows.map((row, index) => (
                <View key={`${row.ruleId}-${index}`} style={{ marginBottom: 4 }} wrap={false}>
                  <View style={styles.item}>
                    <Text style={styles.rule}>{row.ruleId}</Text>
                    <Text style={styles.itemText}>
                      {row.check} — {row.status}
                    </Text>
                  </View>
                  {row.formula ? <Text style={styles.formula}>{row.formula}</Text> : null}
                  {row.note ? <Text style={styles.note}>{row.note}</Text> : null}
                </View>
              ))}
            </View>
          ))}
        </Section>

        <Section title={`4. ${t('export.pdf.architecture')}`}>
          {doc.architecture.map((node, index) => (
            <View key={node.node} style={styles.item} wrap={false}>
              <Text style={styles.rule}>{index + 1}</Text>
              <Text style={styles.itemText}>
                {node.node}
                {node.detail ? `: ${node.detail}` : ''}
                {node.equipment ? ` — ${node.equipment}` : ''}
              </Text>
            </View>
          ))}
        </Section>

        <Section title={`5. ${t('export.pdf.bom')}`}>
          {doc.bom ? (
            <View>
              <Text style={{ marginBottom: 4 }}>{t('export.excel.level', { level: doc.bom.level, margin: doc.bom.margin != null ? doc.bom.margin.toFixed(2) : '—' })}</Text>
              <View style={styles.th}>
                <Text style={styles.cCat}>{t('export.excel.columns.category')}</Text>
                <Text style={styles.cName}>{t('export.excel.columns.description')}</Text>
                <Text style={styles.cQty}>{t('export.excel.columns.qty')}</Text>
                <Text style={styles.cRule}>{t('export.excel.columns.rules')}</Text>
              </View>
              {doc.bom.lines.map((line, index) => (
                <View key={`${line.code}-${index}`} style={styles.td} wrap={false}>
                  <Text style={styles.cCat}>{line.category}</Text>
                  {/* Tên và mô tả là HAI Text: "\n" giữa một Text làm react-pdf rơi về Helvetica (test-export-pdf.mts). */}
                  <View style={styles.cName}>
                    <Text style={line.placeholder ? styles.assumed : undefined}>{`${line.name}${line.unverified ? ' *' : ''}`}</Text>
                    {line.summary ? <Text style={styles.note}>{line.summary}</Text> : null}
                  </View>
                  <Text style={styles.cQty}>{line.qty}</Text>
                  <Text style={styles.cRule}>{line.rules}</Text>
                </View>
              ))}
              {doc.hasUnverified ? <Text style={styles.footnote}>{t('export.unverifiedNote')}</Text> : null}
              <Text style={styles.note}>{t('export.pdf.noPrices')}</Text>
            </View>
          ) : (
            <Text>{t('export.noBom')}</Text>
          )}
        </Section>

        <Section title={`6. ${t('export.pdf.feasibility')}`}>
          <Text>{doc.feasibility.status}</Text>
          {doc.feasibility.blockers.length > 0 ? (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.subTitle}>{t('designer.requirement.analysis.toFeasible')}</Text>
              <RuleItems items={doc.feasibility.blockers} />
            </View>
          ) : null}
        </Section>

        <Section title={`7. ${t('export.pdf.warnings')}`}>
          {doc.warnings.length > 0 ? (
            <RuleItems items={doc.warnings.map((w) => ({ ruleId: w.ruleId, text: `${w.status} — ${w.text}` }))} />
          ) : (
            <Text>{t('export.pdf.noWarnings')}</Text>
          )}
        </Section>

        <Section title={`8. ${t('export.pdf.validation')}`}>
          {doc.validationPlan.length > 0 ? (
            doc.validationPlan.map((item, index) => (
              <View key={index} style={styles.item} wrap={false}>
                <Text style={styles.rule}>{index + 1}.</Text>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text>{t('export.pdf.noValidation')}</Text>
          )}
        </Section>

        <Text style={styles.disclaimer}>{t('designer.requirement.analysis.disclaimer')}</Text>
        {footer}
      </Page>

      {/* Trang riêng, bắt buộc (UI_CONTENT màn 7). */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('designer.requirement.bom.assumptionsTitle')}</Text>
          <Text style={styles.subtitle}>
            {doc.projectName} — Rev {doc.revLabel}
          </Text>
        </View>
        <Text>{t('designer.requirement.bom.assumptionsIntro')}</Text>
        <View style={{ marginTop: 6 }}>
          {doc.assumptions.length > 0 ? <Rows rows={doc.assumptions} /> : <Text>{t('designer.requirement.bom.noAssumptions')}</Text>}
        </View>
        <Section title={t('designer.requirement.bom.exclusionsTitle')}>
          {doc.exclusions.map((item) => (
            <Text key={item}>• {item}</Text>
          ))}
        </Section>
        <Section title={t('designer.requirement.bom.feasibilityAt')}>
          <Text style={styles.statusText}>{doc.feasibility.status}</Text>
        </Section>
        {footer}
      </Page>
    </Document>
  );
}

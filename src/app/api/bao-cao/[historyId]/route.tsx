import { NextResponse, type NextRequest } from 'next/server';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getSessionContext, hasAdvancedFeatures } from '@/lib/auth';
import { registerPdfFonts } from '@/lib/pdf/fonts';
import { SelectorReport, type ReportData } from '@/lib/pdf/SelectorReport';
import { FIELD_CATALOG } from '@/lib/selector/fields';
import type { SelectorInput, SelectorResult } from '@/lib/selector/types';
import { createClient } from '@/lib/supabase/server';

type HistoryRow = {
  id: string;
  created_at: string;
  input_json: SelectorInput;
  result_json: SelectorResult;
  task_types: { name_vi: string; name_en: string } | null;
};

/**
 * Xuất báo cáo PDF cho một lần chạy bộ chọn thiết bị (CLAUDE.md mục 4 — tính
 * năng VIP trở lên).
 *
 * Bảo mật: route đọc LẠI kết quả từ selector_history theo id, không nhận dữ liệu
 * do client gửi lên. RLS chỉ trả về dòng của chính người đang đăng nhập, nên
 * không thể đoán id để lấy báo cáo của người khác.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ historyId: string }> }
) {
  const { historyId } = await params;

  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  if (!hasAdvancedFeatures(session.profile?.role)) {
    return NextResponse.json({ error: 'vip_required' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('selector_history')
    .select('id, created_at, input_json, result_json, task_types(name_vi, name_en)')
    .eq('id', historyId)
    .maybeSingle();

  const history = data as unknown as HistoryRow | null;
  if (!history) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const locale = (await getLocale()) === 'en' ? 'en' : 'vi';
  const format = await getFormatter();
  const tReport = await getTranslations('selector.report');
  const tFields = await getTranslations('selector.fields');
  const tOptions = await getTranslations('selector.options');
  const tResult = await getTranslations('selector.result');
  const tApproach = await getTranslations('selector.approach');

  // Dịch giá trị đã lưu sang chữ đọc được, dùng đúng catalog mà form đã dùng.
  const inputs = Object.entries(history.input_json ?? {})
    .map(([key, value]) => {
      const def = FIELD_CATALOG[key];
      if (!def) return null;

      const label = def.unit ? `${tFields(def.labelKey)} (${def.unit})` : tFields(def.labelKey);

      let text: string;
      if (value === null || value === undefined || value === '') {
        text = '—';
      } else if (Array.isArray(value)) {
        text =
          value.length === 0
            ? '—'
            : value
                .map((item) => {
                  const option = def.options?.find((o) => o.value === item);
                  return option ? tOptions(option.labelKey) : String(item);
                })
                .join(', ');
      } else if (typeof value === 'boolean') {
        text = value ? tReport('yes') : tReport('no');
      } else if (def.options) {
        const option = def.options.find((o) => o.value === value);
        text = option ? tOptions(option.labelKey) : String(value);
      } else {
        text = String(value);
      }

      return { label, value: text };
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null);

  const metricLabels: Record<string, string> = {};
  for (const metric of history.result_json?.derived ?? []) {
    metricLabels[metric.key] = tResult(`metrics.${metric.key}`);
  }

  const reportData: ReportData = {
    taskName:
      (locale === 'en' ? history.task_types?.name_en : history.task_types?.name_vi) ??
      tReport('unknownTask'),
    userEmail: session.profile?.email ?? session.user.email ?? '',
    createdAt: format.dateTime(new Date(history.created_at), {
      dateStyle: 'long',
      timeStyle: 'short',
    }),
    inputs,
    result: history.result_json,
    approachLabel: tApproach(history.result_json?.approach ?? 'rule_based'),
    metricLabels,
    locale,
  };

  registerPdfFonts();

  const buffer = await renderToBuffer(
    <SelectorReport
      data={reportData}
      labels={{
        title: tReport('title'),
        task: tReport('task'),
        generatedAt: tReport('generatedAt'),
        generatedFor: tReport('generatedFor'),
        inputs: tReport('inputs'),
        result: tResult('title'),
        camera: tResult('camera'),
        processing: tResult('processing'),
        accessories: tResult('accessories'),
        lighting: tResult('lighting'),
        lens: tResult('lens'),
        approach: tReport('approach'),
        approachReason: tResult('approachReason'),
        calculations: tResult('calculations'),
        notes: tResult('notes'),
        notSpecified: tResult('notSpecified'),
        disclaimer: tReport('disclaimer'),
        page: tReport('page'),
      }}
    />
  );

  const stamp = new Date(history.created_at).toISOString().slice(0, 10);
  const filename = `machine-vision-hub-${stamp}-${history.id.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Báo cáo gắn với tài khoản cụ thể — không cho CDN hay proxy lưu lại.
      'Cache-Control': 'private, no-store',
    },
  });
}

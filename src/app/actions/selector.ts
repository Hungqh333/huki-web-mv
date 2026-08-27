'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getSessionContext, canUseSelector } from '@/lib/auth';
import { getFieldDefs, parseInput } from '@/lib/selector/fields';
import { runSelector } from '@/lib/selector/engine';
import type { SelectorInput, SelectorResult, SelectorRule } from '@/lib/selector/types';

export type SelectorState = {
  error?: string;
  fieldErrors?: Record<string, 'required' | 'invalid'>;
  result?: SelectorResult;
  input?: SelectorInput;
  /** false = đã chạy nhưng không lưu được lịch sử; nói thật thay vì im lặng. */
  historySaved?: boolean;
  /** Có id thì mới xuất được PDF — báo cáo đọc lại từ database theo id này. */
  historyId?: string;
};

export async function runSelectorAction(
  _prevState: SelectorState,
  formData: FormData
): Promise<SelectorState> {
  const t = await getTranslations('selector.errors');

  const slug = formData.get('task_slug');
  if (typeof slug !== 'string' || slug === '') return { error: t('unknownTask') };

  // Chặn ở UI cho thân thiện. Chặn thật nằm ở RLS: không phải Member trở lên
  // thì truy vấn selector_rules bên dưới trả về rỗng.
  const session = await getSessionContext();
  if (!session) return { error: t('notSignedIn') };
  if (!canUseSelector(session.profile?.role)) return { error: t('notAllowed') };

  const supabase = await createClient();

  const { data: taskType } = await supabase
    .from('task_types')
    .select('id, input_fields')
    .eq('slug', slug)
    .maybeSingle<{ id: string; input_fields: unknown }>();

  if (!taskType) return { error: t('unknownTask') };

  const defs = getFieldDefs(taskType.input_fields);
  if (defs.length === 0) return { error: t('noFields') };

  const { input, errors } = parseInput(defs, formData);
  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors, input };
  }

  const { data: rules, error: rulesError } = await supabase
    .from('selector_rules')
    .select(
      'id, code, task_type_id, condition_json, recommended_camera, recommended_lighting, ' +
        'recommended_lens, ai_or_rule_based, notes_vi, notes_en, priority, is_active'
    )
    .eq('task_type_id', taskType.id)
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (rulesError) return { error: rulesError.message, input };
  if (!rules || rules.length === 0) return { error: t('noRules'), input };

  const result = runSelector(rules as unknown as SelectorRule[], input);

  // Lưu lịch sử cho Member+ (RLS cũng yêu cầu đúng như vậy).
  // Lấy lại id để nút xuất PDF trỏ tới đúng bản ghi này.
  const { data: saved, error: historyError } = await supabase
    .from('selector_history')
    .insert({
      user_id: session.user.id,
      task_type_id: taskType.id,
      input_json: input,
      result_json: result,
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  return {
    result,
    input,
    historySaved: !historyError,
    historyId: saved?.id,
  };
}

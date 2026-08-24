import type {
  ConditionOperator,
  ConditionPredicate,
  EvalContext,
  RuleCondition,
} from './types';

const OPERATORS: ReadonlySet<string> = new Set<ConditionOperator>([
  'eq',
  'ne',
  'lt',
  'lte',
  'gt',
  'gte',
  'in',
  'nin',
  'exists',
]);

export function isConditionOperator(value: unknown): value is ConditionOperator {
  return typeof value === 'string' && OPERATORS.has(value);
}

/**
 * Kiểm tra condition_json đọc từ database có đúng định dạng không.
 * Trả về danh sách lỗi rỗng nghĩa là hợp lệ. Dùng lại được cho admin UI ở
 * Prompt 4 để validate trước khi lưu.
 */
export function validateCondition(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return ['condition_json phải là một object.'];
  }

  const condition = raw as Record<string, unknown>;
  const unknownKeys = Object.keys(condition).filter((key) => key !== 'all');
  const errors = unknownKeys.map((key) => `Khoá không hỗ trợ: "${key}". Chỉ dùng "all".`);

  if (condition.all === undefined) return errors;
  if (!Array.isArray(condition.all)) {
    errors.push('"all" phải là một mảng điều kiện.');
    return errors;
  }

  condition.all.forEach((entry, index) => {
    const at = `all[${index}]`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push(`${at} phải là object {field, op, value}.`);
      return;
    }

    const predicate = entry as Record<string, unknown>;
    if (typeof predicate.field !== 'string' || predicate.field.trim() === '') {
      errors.push(`${at}.field phải là chuỗi không rỗng.`);
    }
    if (!isConditionOperator(predicate.op)) {
      errors.push(`${at}.op không hợp lệ: ${JSON.stringify(predicate.op)}.`);
    }
    if ((predicate.op === 'in' || predicate.op === 'nin') && !Array.isArray(predicate.value)) {
      errors.push(`${at}.value phải là mảng khi op là "${predicate.op}".`);
    }
    if (predicate.op === 'exists' && typeof predicate.value !== 'boolean') {
      errors.push(`${at}.value phải là true/false khi op là "exists".`);
    }
  });

  return errors;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function evaluatePredicate(predicate: ConditionPredicate, context: EvalContext): boolean {
  const actual = context[predicate.field];

  if (predicate.op === 'exists') {
    return predicate.value === true ? !isEmpty(actual) : isEmpty(actual);
  }

  // Người dùng bỏ trống trường -> luật gắn với trường đó không khớp, thay vì
  // khớp nhầm do so sánh với null.
  if (isEmpty(actual)) return false;

  switch (predicate.op) {
    case 'eq':
      return actual === predicate.value;
    case 'ne':
      return actual !== predicate.value;

    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte': {
      const left = toNumber(actual);
      const right = toNumber(predicate.value);
      if (left === null || right === null) return false;
      if (predicate.op === 'lt') return left < right;
      if (predicate.op === 'lte') return left <= right;
      if (predicate.op === 'gt') return left > right;
      return left >= right;
    }

    case 'in':
    case 'nin': {
      if (!Array.isArray(predicate.value)) return false;
      const expected = predicate.value as unknown[];
      // Trường nhiều lựa chọn (ví dụ environment) khớp khi giao nhau khác rỗng.
      const hit = Array.isArray(actual)
        ? actual.some((item) => expected.includes(item))
        : expected.includes(actual);
      return predicate.op === 'in' ? hit : !hit;
    }

    default:
      return false;
  }
}

/**
 * Luật khớp khi TẤT CẢ predicate đều đúng.
 * Điều kiện rỗng = luật nền, luôn khớp.
 */
export function matchesCondition(condition: RuleCondition | null, context: EvalContext): boolean {
  if (!condition?.all || condition.all.length === 0) return true;
  return condition.all.every((predicate) => evaluatePredicate(predicate, context));
}

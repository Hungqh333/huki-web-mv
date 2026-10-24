import type { Option } from '@/lib/lightLabels';

/**
 * Ô nhập dùng chung cho trang sửa thực nghiệm chiếu sáng — thuần HTML, chạy được trong trang
 * máy chủ (form gửi thẳng vào server action, không cần JavaScript ở trình duyệt).
 */

export const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';

export function SelectField({
  name,
  label,
  options,
  empty,
  value,
  required = false,
}: {
  name: string;
  label: string;
  options: readonly Option[];
  empty?: string;
  value?: string | null;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select name={name} required={required} defaultValue={value ?? ''} className={inputClass}>
        {empty !== undefined ? (
          <option value="" disabled={required}>
            {empty}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField({
  name,
  label,
  value,
  type = 'text',
  placeholder,
  required = false,
  max = 120,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  type?: 'text' | 'number' | 'date' | 'url';
  placeholder?: string;
  required?: boolean;
  max?: number;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        required={required}
        maxLength={type === 'text' || type === 'url' ? max : undefined}
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        className={inputClass}
      />
    </label>
  );
}

export function AreaField({
  name,
  label,
  value,
  placeholder,
  max = 1000,
  rows = 3,
}: {
  name: string;
  label: string;
  value?: string | null;
  placeholder?: string;
  max?: number;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <textarea name={name} defaultValue={value ?? ''} placeholder={placeholder} maxLength={max} rows={rows} className={inputClass} />
    </label>
  );
}

export function SubmitButton({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'secondary' }) {
  return (
    <button
      type="submit"
      className={
        tone === 'primary'
          ? 'rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700'
          : 'rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
      }
    >
      {children}
    </button>
  );
}

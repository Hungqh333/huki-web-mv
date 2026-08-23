import type { InputHTMLAttributes } from 'react';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, id, name, ...inputProps }: FieldProps) {
  const fieldId = id ?? name;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        {...inputProps}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={
        error
          ? 'rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300'
          : 'rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
      }
    >
      {error ?? notice}
    </p>
  );
}

export function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

import { SPEC_FIELDS, SUMMARY_KEYS, type Component } from '@/lib/components/specs';

/** Tên hiển thị của một thiết bị trong kho. */
export const nameOf = (component: Component) => `${component.brand} ${component.model}`;

/** Thông số tóm tắt theo loại thiết bị (SUMMARY_KEYS), vd. "5 MP · 3.45 µm". */
export function summarise(component: Component): string {
  const keys = SUMMARY_KEYS[component.kind] ?? [];
  return (SPEC_FIELDS[component.kind] ?? [])
    .filter((field) => keys.includes(field.key))
    .map((field) => {
      const value = component.spec[field.key];
      if (value === undefined || value === null || value === '') return null;
      return `${value}${field.unit ? ` ${field.unit}` : ''}`;
    })
    .filter(Boolean)
    .join(' · ');
}

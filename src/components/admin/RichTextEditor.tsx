'use client';

import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Trình soạn thảo cho content_vi / content_en.
 *
 * Giá trị được đồng bộ vào một input ẩn để form vẫn submit theo cơ chế
 * FormData bình thường — server action không cần biết gì về Tiptap.
 *
 * Bảo mật: HTML sinh ra ở đây vẫn được làm sạch lại ở phía server trước khi
 * ghi vào database (src/lib/html.ts). Không tin dữ liệu từ client.
 */
export function RichTextEditor({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  const t = useTranslations('admin.editor');
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
    ],
    content: defaultValue,
    // Tránh cảnh báo hydration: Tiptap chỉ dựng DOM sau khi đã ở client.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-56 max-w-none px-3 py-2 outline-none [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3',
      },
    },
    onUpdate: ({ editor: instance }) => setHtml(instance.getHTML()),
  });

  // Không đồng bộ lại html từ editor lúc khởi tạo: nếu người dùng không sửa gì
  // thì input ẩn giữ đúng nội dung gốc, đó mới là điều mình muốn submit.

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>

      <div className="overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
        {editor ? <Toolbar editor={editor} /> : null}
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="min-h-56 px-3 py-2 text-sm text-slate-400">{t('loading')}</div>
        )}
      </div>

      <input type="hidden" name={name} value={html} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations('admin.editor');

  const buttons = [
    { key: 'bold', run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { key: 'italic', run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { key: 'h2', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { key: 'h3', run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    { key: 'bullet', run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { key: 'ordered', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { key: 'quote', run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
    { key: 'code', run: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock') },
  ] as const;

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-1.5 dark:border-slate-800 dark:bg-slate-900">
      {buttons.map((button) => (
        <button
          key={button.key}
          type="button"
          onClick={button.run}
          aria-pressed={button.active}
          className={
            button.active
              ? 'rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white'
              : 'rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'
          }
        >
          {t(button.key)}
        </button>
      ))}
    </div>
  );
}

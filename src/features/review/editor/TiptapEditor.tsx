
import React, { useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

export default function TiptapEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    content: value || '',
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' },
      }),
    ],
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[120px]',
      },
    },
  });

  const toggle = (fn: () => any) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('Inserisci URL', prev) || '';
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    try {
      const u = new URL(url);
      if (!/^https?:/i.test(u.protocol)) throw new Error('Solo http/https');
    } catch {
      // if the scheme is missing, prepend https://
      editor.chain().focus().setLink({ href: /^https?:\/\//i.test(url) ? url : `https://${url}` }).run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return <div className={className || ''} />;

  return (
    <div className={className || ''}>
      <div className="flex flex-wrap gap-1 mb-2">
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleBold().run())} className="px-2 py-1 text-sm border rounded">B</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleItalic().run())} className="px-2 py-1 text-sm border rounded italic">I</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleUnderline().run())} className="px-2 py-1 text-sm border rounded underline">U</button>
        <span className="mx-1 w-px bg-gray-300" />
        <button type="button" onClick={setLink} className="px-2 py-1 text-sm border rounded">🔗 link</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().unsetLink().run())} className="px-2 py-1 text-sm border rounded">⛓️ remove</button>
        <span className="mx-1 w-px bg-gray-300" />
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleBulletList().run())} className="px-2 py-1 text-sm border rounded">• elenco</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleOrderedList().run())} className="px-2 py-1 text-sm border rounded">1. elenco</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().setHorizontalRule().run())} className="px-2 py-1 text-sm border rounded">HR</button>
        <span className="mx-1 w-px bg-gray-300" />
        <button type="button" onClick={toggle(() => editor.chain().focus().undo().run())} className="px-2 py-1 text-sm border rounded">↶</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().redo().run())} className="px-2 py-1 text-sm border rounded">↷</button>
      </div>
      <div className="border rounded-md p-3 bg-white">
        <style>{`.ProseMirror a { text-decoration: underline; } .ProseMirror p.is-editor-empty:first-child::before { color: #9ca3af; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; }`}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

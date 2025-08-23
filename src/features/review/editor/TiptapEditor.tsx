import React, { useCallback } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

type Props = { value: string; onChange: (html: string) => void };

export default function TiptapEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: { keepMarks: true }, orderedList: { keepMarks: true } }),
      Underline,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank', class: 'underline' },
        validate: href => /^https?:\/\//i.test(href),
      }),
    ],
    content: value || '',
    onUpdate({ editor }) { onChange(editor.getHTML()); },
  });

  const toggle = (cmd: () => void) => (e: React.MouseEvent) => { e.preventDefault(); cmd(); };

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('Inserisci URL (https://...)', previous);
    if (url === null) return;
    if (url === '') { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return <div className="border rounded-md p-3 min-h-[140px] bg-white" />;

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1 mb-2">
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleBold().run())} className="px-2 py-1 text-sm border rounded font-semibold">B</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleItalic().run())} className="px-2 py-1 text-sm border rounded italic">I</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleUnderline().run())} className="px-2 py-1 text-sm border rounded underline">U</button>
        <span className="mx-1 w-px bg-gray-300" />
        <button type="button" onClick={setLink} className="px-2 py-1 text-sm border rounded">🔗 link</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleBulletList().run())} className="px-2 py-1 text-sm border rounded">• elenco</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().toggleOrderedList().run())} className="px-2 py-1 text-sm border rounded">1. elenco</button>
        <button type="button" onClick={toggle(() => editor.chain().focus().setHorizontalRule().run())} className="px-2 py-1 text-sm border rounded">HR</button>
      </div>
      <div className="border rounded-md p-3 min-h-[140px] bg-white prose prose-sm max-w-none">
        <style>{` .ProseMirror a { text-decoration: underline; } `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

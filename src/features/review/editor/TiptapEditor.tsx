import React from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

export default function TiptapEditor({ value, onChange }: { value: string; onChange: (html: string) => void; }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ autolink: true, openOnClick: false, HTMLAttributes: { rel: 'noreferrer noopener' } }),
      Underline
    ],
    content: value || '',
    onUpdate({ editor }) { onChange(editor.getHTML()); },
  });
  if (!editor) return null;
  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Inserisci URL', prev || 'https://');
    if (url === null) return;
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url, rel: 'noreferrer noopener' }).run();
  };
  return (
    <div>
      <div className="flex gap-1 mb-2">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 py-1 text-sm border rounded">B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 py-1 text-sm border rounded">I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className="px-2 py-1 text-sm border rounded">U</button>
        <button type="button" onClick={setLink} className="px-2 py-1 text-sm border rounded">🔗</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-2 py-1 text-sm border rounded">•</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className="px-2 py-1 text-sm border rounded">1.</button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 text-sm border rounded">HR</button>
      </div>
      <div className="border rounded-md p-3 min-h-[140px] bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
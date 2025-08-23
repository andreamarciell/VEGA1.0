
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
        protocols: ['http', 'https', 'mailto', 'ftp', 'tel'],
        HTMLAttributes: {
          rel: 'noreferrer noopener',
        },
      }),
    ],
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Inserisci URL', previousUrl || '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    try {
      const trimmed = url.trim();
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: trimmed })
        .run();
    } catch (e) {
      console.error(e);
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="w-full rounded-md border border-gray-300 p-3 text-gray-500 bg-white">
        Caricamento editor...
      </div>
    );
  }

  return (
    <div className={className ?? ''}>
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 text-sm border rounded ${editor.isActive('bold') ? 'bg-gray-200' : ''}`}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 text-sm border rounded ${editor.isActive('italic') ? 'bg-gray-200' : ''}`}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`px-2 py-1 text-sm border rounded ${editor.isActive('underline') ? 'bg-gray-200' : ''}`}
        >
          U
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 text-sm border rounded ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 text-sm border rounded ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
        >
          1. List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="px-2 py-1 text-sm border rounded"
        >
          ―
        </button>
        <button
          type="button"
          onClick={setLink}
          className={`px-2 py-1 text-sm border rounded ${editor.isActive('link') ? 'bg-gray-200' : ''}`}
        >
          🔗 Link
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="px-2 py-1 text-sm border rounded"
        >
          ✕ Unlink
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className="px-2 py-1 text-sm border rounded"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className="px-2 py-1 text-sm border rounded"
        >
          ↷ Redo
        </button>
      </div>

      <div className="rounded-md border border-gray-300 bg-white p-3 min-h-[120px]">
        <EditorContent editor={editor} />
        {placeholder && !editor.getText().trim() && (
          <div className="pointer-events-none text-gray-400">{placeholder}</div>
        )}
      </div>
    </div>
  );
}

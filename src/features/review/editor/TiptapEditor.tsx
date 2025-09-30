import React, { useCallback, useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, Link2, List, ListOrdered, Underline as UnderlineIcon } from 'lucide-react';

type Props = { 
  value: string; 
  onChange: (html: string) => void;
  minHeight?: string;
  placeholder?: string;
};

export default function TiptapEditor({ value, onChange, minHeight = '140px', placeholder = '' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ 
        bulletList: { keepMarks: true }, 
        orderedList: { keepMarks: true } 
      }),
      Underline,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank', class: 'underline text-blue-600' },
        validate: href => /^https?:\/\//i.test(href),
      }),
    ],
    content: value || '',
    onUpdate({ editor }) { 
      onChange(editor.getHTML()); 
    },
    editorProps: {
      attributes: {
        class: 'outline-none focus:outline-none prose prose-sm max-w-none',
      },
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  const toggle = (cmd: () => void) => (e: React.MouseEvent) => { 
    e.preventDefault(); 
    cmd(); 
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href || '';
    const url = window.prompt('Inserisci URL (https://...)', previous);
    if (url === null) return;
    if (url === '') { 
      editor.chain().focus().unsetLink().run(); 
      return; 
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  if (!editor) return <div className="border border-gray-300 rounded-lg p-4 bg-white" style={{ minHeight }} />;

  const isLinkActive = editor.isActive('link');

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1 mb-2 p-2 bg-gray-50 border border-gray-300 rounded-t-lg">
        <button 
          type="button" 
          onClick={toggle(() => editor.chain().focus().toggleBold().run())} 
          className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-100 transition-colors ${editor.isActive('bold') ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
          title="Grassetto (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button 
          type="button" 
          onClick={toggle(() => editor.chain().focus().toggleItalic().run())} 
          className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-100 transition-colors ${editor.isActive('italic') ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
          title="Corsivo (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button 
          type="button" 
          onClick={toggle(() => editor.chain().focus().toggleUnderline().run())} 
          className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-100 transition-colors ${editor.isActive('underline') ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
          title="Sottolineato (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <span className="mx-1 w-px bg-gray-300" />
        <button 
          type="button" 
          onClick={setLink} 
          className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-100 transition-colors flex items-center gap-1 ${isLinkActive ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
          title="Aggiungi/Modifica link"
        >
          <Link2 className="w-4 h-4" />
          <span className="text-xs">Link</span>
        </button>
        {isLinkActive && (
          <button 
            type="button" 
            onClick={removeLink} 
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-red-50 hover:border-red-300 transition-colors text-red-600"
            title="Rimuovi link"
          >
            Rimuovi link
          </button>
        )}
        <span className="mx-1 w-px bg-gray-300" />
        <button 
          type="button" 
          onClick={toggle(() => editor.chain().focus().toggleBulletList().run())} 
          className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-100 transition-colors ${editor.isActive('bulletList') ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
          title="Elenco puntato"
        >
          <List className="w-4 h-4" />
        </button>
        <button 
          type="button" 
          onClick={toggle(() => editor.chain().focus().toggleOrderedList().run())} 
          className={`px-3 py-1.5 text-sm border rounded hover:bg-gray-100 transition-colors ${editor.isActive('orderedList') ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}
          title="Elenco numerato"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
      </div>
      <div 
        className="border border-gray-300 border-t-0 rounded-b-lg p-4 bg-white prose prose-sm max-w-none"
        style={{ minHeight }}
      >
        <style>{` 
          .ProseMirror a { 
            text-decoration: underline; 
            color: #2563eb;
            cursor: pointer;
          }
          .ProseMirror:focus {
            outline: none;
          }
          .ProseMirror p.is-editor-empty:first-child::before {
            content: "${placeholder}";
            color: #9ca3af;
            pointer-events: none;
            float: left;
            height: 0;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

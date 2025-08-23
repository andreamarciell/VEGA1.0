
// src/features/review/components/SectionForms/ReputationalIndicatorsFullForm.tsx
// Same behaviour of the "Adverse" form but connected to fullData branch.
import React, { useEffect, useMemo, useState } from "react";
import { useFormContext } from "../../context/FormContext";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

type IndicatorItem = {
  id: string;
  author?: string;
  url?: string;
  date?: string;
  match?: string;
  contentHtml?: string;
};

function buildPrefix(item: Partial<IndicatorItem>) {
  const parts: string[] = [];
  if (item.author) parts.push(`di ${item.author}`);
  if (item.date) parts.push(`datato ${item.date}`);
  if (item.match) parts.push(item.match);
  const core = parts.length ? `Secondo l'articolo ${parts.join(" ")}:` : `Secondo l'articolo:`;
  return `<p><strong>${core}</strong></p>`;
}

export default function ReputationalIndicatorsFullForm() {
  const { state, setState, markSectionComplete } = useFormContext();
  const savedItems: IndicatorItem[] = (state?.fullData as any)?.reputationalIndicatorsItems ?? [];
  const [items, setItems] = useState<IndicatorItem[]>(savedItems);
  const [current, setCurrent] = useState<IndicatorItem | null>(items[0] ?? null);

  // hydrate
  useEffect(() => {
    const persisted: IndicatorItem[] = (state?.fullData as any)?.reputationalIndicatorsItems ?? [];
    if (Array.isArray(persisted)) {
      const a = JSON.stringify(persisted);
      const b = JSON.stringify(items);
      if (a !== b) setItems(persisted);
    }
  }, [state?.fullData?.reputationalIndicatorsItems]);

  useEffect(() => {
    if (!current && items.length) setCurrent(items[0]);
  }, [items, current]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        autolink: true,
        openOnClick: false,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto", "tel"],
      }),
    ],
    content: current?.contentHtml ?? "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (current) {
        const upd = { ...current, contentHtml: html };
        setCurrent(upd);
        setItems((arr) => arr.map((x) => (x.id === upd.id ? upd : x)));
      }
    },
  });

  useEffect(() => {
    if (editor && current?.contentHtml !== undefined) {
      editor.commands.setContent(current.contentHtml, false);
    }
  }, [current?.id]);

  function setField<K extends keyof IndicatorItem>(k: K, v: IndicatorItem[K]) {
    if (!current) return;
    const upd = { ...current, [k]: v };
    if (!upd.contentHtml || /^<p><strong>Secondo l'articolo/.test(upd.contentHtml)) {
      const body = upd.contentHtml?.replace(/^<p><strong>Secondo[\s\S]*?<\/strong><\/p>/, "").trim() ?? "";
      upd.contentHtml = buildPrefix(upd) + (body ? body : "<p></p>");
      if (editor) editor.commands.setContent(upd.contentHtml, false);
    }
    setCurrent(upd);
    setItems((arr) => arr.map((x) => (x.id === upd.id ? upd : x)));
  }

  function addItem() {
    const it: IndicatorItem = {
      id: Math.random().toString(36).slice(2),
      match: "corrispondenza definitiva via nome + età + area + foto",
      contentHtml: buildPrefix({ match: "corrispondenza definitiva via nome + età + area + foto" }) + "<p></p>",
    };
    setItems((arr) => [it, ...arr]);
    setCurrent(it);
  }

  function saveToGlobal() {
    const hasAny = items.some((x) => (x.contentHtml ?? "").replace(/<[^>]+>/g, "").trim().length > 0);
    setState((prev) => ({
      ...prev,
      fullData: {
        ...(prev?.fullData ?? {}),
        reputationalIndicatorsItems: items,
        reputationalIndicatorsRich: items.map((x) => x.contentHtml ?? ""),
      },
    }));
    markSectionComplete("reputationalIndicatorsFull", hasAny);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className="px-3 py-2 rounded bg-gray-100" onClick={addItem}>+ Aggiungi indicatore</button>
        <button type="button" className="px-3 py-2 rounded bg-blue-600 text-white" onClick={saveToGlobal}>Salva</button>
      </div>

      {current && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="border rounded p-2" placeholder="Autore" value={current.author ?? ""} onChange={(e) => setField("author", e.target.value)} />
            <input className="border rounded p-2" placeholder="URL articolo" value={current.url ?? ""} onChange={(e) => setField("url", e.target.value)} />
            <input className="border rounded p-2" placeholder="Data (es. 31/07/2025)" value={current.date ?? ""} onChange={(e) => setField("date", e.target.value)} />
            <input className="border rounded p-2" placeholder="Corrispondenza" value={current.match ?? ""} onChange={(e) => setField("match", e.target.value)} />
          </div>

          <div className="border rounded p-2">
            <EditorContent editor={editor} />
            <div className="text-xs text-gray-500 pt-1">Suggerimento: seleziona un testo e premi ⌘K / Ctrl+K per aggiungere un link.</div>
          </div>
        </div>
      )}
    </div>
  );
}

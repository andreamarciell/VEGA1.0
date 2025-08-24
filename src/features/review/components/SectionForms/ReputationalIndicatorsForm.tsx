
import React, { useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { generateSummaryAI, AiCtx } from "../../services/aiSummary";

type Props = {
  value?: {
    author?: string;
    url?: string;
    match?: string;
    articleDate?: string;
    sourceText?: string;
    summaryHtml?: string;
  };
  onChange?: (v: Props["value"]) => void;
};

const sanitize = (html: string) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // strip script/style and on* attributes
  tmp.querySelectorAll("script,style").forEach(n => n.remove());
  tmp.querySelectorAll("*").forEach((el: any) => {
    [...el.attributes].forEach((a: any) => {
      if (/^on/i.test(a.name)) el.removeAttribute(a.name);
      if (a.name === "href" && /^javascript:/i.test(a.value)) el.removeAttribute("href");
    });
  });
  return tmp.innerHTML;
};

export default function ReputationalIndicatorsForm({ value, onChange }: Props) {
  const [author, setAuthor] = useState(value?.author || "");
  const [url, setUrl] = useState(value?.url || "");
  const [match, setMatch] = useState(value?.match || "");
  const [articleDate, setArticleDate] = useState(value?.articleDate || "");
  const [sourceText, setSourceText] = useState(value?.sourceText || "");
  const [hasSummary, setHasSummary] = useState(!!value?.summaryHtml);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: value?.summaryHtml || "",
    onUpdate: ({ editor }) => {
      const html = sanitize(editor.getHTML());
      onChange?.({ author, url, match, articleDate, sourceText, summaryHtml: html });
    },
    editable: hasSummary,
  }, [hasSummary]);

  const handleSummarize = async () => {
    const ctx: AiCtx = { author, articleDate, matchLabel: match };
    const summary = await generateSummaryAI(sourceText || "", ctx);
    const html = sanitize(`<p>${summary}</p>`);
    editor?.commands.setContent(html);
    setHasSummary(true);
    onChange?.({ author, url, match, articleDate, sourceText, summaryHtml: html });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input id="ri-author" className="input input-bordered" placeholder="Autore (testata)" value={author} onChange={e => setAuthor(e.target.value)} />
        <input id="ri-url" className="input input-bordered" placeholder="Fonte (URL)" value={url} onChange={e => setUrl(e.target.value)} />
        <select id="ri-match" className="select select-bordered" value={match} onChange={e => setMatch(e.target.value)}>
          <option value="">match</option>
          <option value="corrispondenza definitiva via nome + età + area + foto">corrispondenza definitiva via nome + età + area + foto</option>
          <option value="corrispondenza probabile via nome + età + area">corrispondenza probabile via nome + età + area</option>
        </select>
        <input id="ri-article-date" type="date" className="input input-bordered" value={articleDate} onChange={e => setArticleDate(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm opacity-80">Testo da riassumere (input AI)</label>
        <textarea className="textarea textarea-bordered w-full min-h-[110px]" value={sourceText} onChange={e => setSourceText(e.target.value)} />
        <button className="btn btn-primary" onClick={handleSummarize}>Riassumi &amp; invia all'editor</button>
      </div>

      {hasSummary && (
        <div className="space-y-2">
          <label className="text-sm opacity-80">Riassunto (modificabile)</label>
          <div className="border rounded p-2">
            <EditorContent editor={editor} />
          </div>
        </div>
      )}
    </div>
  );
}

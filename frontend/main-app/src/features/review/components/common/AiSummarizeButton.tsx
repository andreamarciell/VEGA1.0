
import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { generateSummaryAI } from '../../services/aiSummary';

type Props = {
  getSource: () => { html: string; url?: string };
  onResult: (html: string, plain: string) => void;
  className?: string;
  label?: string;
};

function stripHtml(html: string): string {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

export default function AiSummarizeButton({ getSource, onResult, className, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setErr(null);
    setLoading(true);
    try {
      const { html, url } = getSource();
      const summary = await generateSummaryAI(html, { language: 'it', urlHint: url });
      const safePlain = stripHtml(summary);
      const outHtml = `<p>${safePlain.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
      onResult(outHtml, safePlain);
    } catch (e: any) {
      setErr(e?.message || 'Errore durante il riassunto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className ?? ''}>
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60"
        title="Riassumi con AI"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        <span>{label ?? 'Riassumi con AI'}</span>
      </button>
      {err ? <div className="mt-1 text-xs text-red-600">{err}</div> : null}
    </div>
  );
}

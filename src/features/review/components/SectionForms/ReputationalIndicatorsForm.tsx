import React, { useMemo, useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { useFormContext } from '../../context/FormContext';
import TiptapEditor from '../../editor/TiptapEditor';
import { sanitizeHtmlBasic } from '../../utils/sanitizeHtml';
import AiSummarizeButton from '../common/AiSummarizeButton';

type Indicator = {
  id: string;
  articleUrl: string;
  articleAuthor: string;
  articleDate?: string;             // only used in FULL
  matchType: string;                // 'positivo' | 'negativo' | 'neutrale' | 'altro'
  matchOther: string;
  summaryHtml: string;              // HTML from editor (sanitized)
};

const DEFAULT_MATCH = 'corrispondenza definitiva via nome + età + area + foto';

function uid() {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2);
}

function textFromHtml(html: string): string {
  const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (tmp) {
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  }
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function Line({children}:{children: React.ReactNode}){return <div className="flex items-center gap-2">{children}</div>;}

export default function ReputationalIndicatorsForm() {
  const { state, updateAdverseData, markSectionComplete } = useFormContext();
  const adverse = state.adverseData ?? ({} as any);

  const [items, setItems] = useState<Indicator[]>(() => {
    const rich = (adverse.reputationalIndicatorsRich as string[] | undefined) ?? [];
    if (rich.length === 0) return [{
      id: uid(), articleUrl: '', articleAuthor: '', matchType: DEFAULT_MATCH, matchOther: '', summaryHtml: ''
    }];
    return rich.map((html) => ({ id: uid(), articleUrl: '', articleAuthor: '', matchType: DEFAULT_MATCH, matchOther: '', summaryHtml: html }));
  });

  const bulletLines = useMemo(() => {
    return items.map((i) => {
      const match = i.matchType === 'altro' ? (i.matchOther || '').trim() : (i.matchType || '').trim();
      const parts = [
        i.articleAuthor?.trim() ? `Autore: ${i.articleAuthor.trim()}` : null,
        match ? `Match: ${match}` : null,
        i.articleUrl?.trim() ? `Fonte: ${i.articleUrl.trim()}` : null,
        textFromHtml(i.summaryHtml) ? `Riassunto: ${textFromHtml(i.summaryHtml)}` : null,
      ].filter(Boolean);
      return parts.length ? '• ' + parts.join(' — ') : '';
    }).filter(Boolean);
  }, [items]);

  const commit = (next: Indicator[]) => {
    setItems(next);
    const sanitizedRich = next.map(x => sanitizeHtmlBasic(x.summaryHtml)).filter(Boolean);
    const plain = bulletLines.join('\n');
    updateAdverseData({
      reputationalIndicatorsRich: sanitizedRich,
      reputationalIndicators: plain,
      reputationalSources: next.map(x => ({ author: x.articleAuthor || '', url: x.articleUrl || '' })),
      reputationalIndicatorsItems: next
    } as any);
    markSectionComplete('reputationalIndicators', sanitizedRich.length > 0 || plain.trim().length > 0);
  };

  const addRow = () => commit([...items, { id: uid(), articleUrl: '', articleAuthor: '', matchType: DEFAULT_MATCH, matchOther: '', summaryHtml: '' }]);
  const removeRow = (id: string) => commit(items.filter(i => i.id !== id));

  const updateField = (id: string, patch: Partial<Indicator>) => {
    const next = items.map(it => (it.id === id ? { ...it, ...patch } : it));
    commit(next);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Indicatori Reputazionali (Adverse Media)</h3>
      <p className="text-sm text-gray-600">Inserisci eventuali fonti e un riassunto. Puoi anche generare il riassunto con AI.</p>

      {items.map((it, idx) => (
        <div key={it.id} className="rounded-xl border p-4 bg-white shadow-sm space-y-3">
          <Line>
            <label className="w-24 text-sm text-gray-600">Autore</label>
            <input value={it.articleAuthor} onChange={e => updateField(it.id, { articleAuthor: e.target.value })}
              className="flex-1 rounded-md border px-2 py-1 text-sm" placeholder="es. Corriere della Sera" />
          </Line>
          <Line>
            <label className="w-24 text-sm text-gray-600">Fonte (URL)</label>
            <input value={it.articleUrl} onChange={e => updateField(it.id, { articleUrl: e.target.value })}
              className="flex-1 rounded-md border px-2 py-1 text-sm" placeholder="https://..." />
          </Line>
          <Line>
            <label className="w-24 text-sm text-gray-600">Match</label>
            <select
              value={it.matchType}
              onChange={e => updateField(it.id, { matchType: e.target.value })}
              className="rounded-md border px-2 py-1 text-sm"
            >
              <option value="positivo">positivo</option>
              <option value="negativo">negativo</option>
              <option value="neutrale">neutrale</option>
              <option value="altro">altro…</option>
              <option value={DEFAULT_MATCH}>{DEFAULT_MATCH}</option>
            </select>
            {it.matchType === 'altro' ? (
              <input
                value={it.matchOther}
                onChange={e => updateField(it.id, { matchOther: e.target.value })}
                className="flex-1 rounded-md border px-2 py-1 text-sm"
                placeholder="specifica il match"
              />
            ) : null}
          </Line>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Riassunto</label>
              <AiSummarizeButton
                getSource={() => ({ html: it.summaryHtml, url: it.articleUrl })}
                onResult={(html) => updateField(it.id, { summaryHtml: sanitizeHtmlBasic(html) })}
              />
            </div>
            <TiptapEditor
              value={it.summaryHtml}
              onChange={(html) => updateField(it.id, { summaryHtml: sanitizeHtmlBasic(html) })}
              className="mt-2"
            />
          </div>

          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => removeRow(it.id)} className="inline-flex items-center gap-2 text-sm text-red-600 hover:underline">
              <Trash2 className="h-4 w-4" /> rimuovi indicatore
            </button>
            {idx === items.length - 1 ? (
              <button type="button" onClick={addRow} className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
                <PlusCircle className="h-4 w-4" /> aggiungi indicatore
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {bulletLines.length ? (
        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
          <div className="font-medium mb-1">Anteprima testo (plain) che andrà nel DOCX:</div>
          <pre className="whitespace-pre-wrap">{bulletLines.join('\n')}</pre>
        </div>
      ) : null}
    </div>
  );
}

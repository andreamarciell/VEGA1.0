
import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext } from '../../context/FormContext';
import { PlusCircle, Trash2 } from 'lucide-react';
import TiptapEditor from '../../editor/TiptapEditor';
import { sanitizeHtmlBasic } from '../../utils/sanitizeHtml';

type Indicator = {
  id: string;
  articleUrl: string;
  articleAuthor: string;
  articleDate: string;
  matchType: string;       // 'positivo' | 'negativo' | 'neutrale' | 'altro'
  matchOther: string;      // testo libero quando matchType === 'altro'
  summaryHtml: string;     // HTML ricco dall'editor
};

const newIndicator = (): Indicator => ({
  id: Math.random().toString(36).slice(2),
  articleUrl: '',
  articleAuthor: '',
  articleDate: '',
  matchType: '',
  matchOther: '',
  summaryHtml: '',
});

function textFromHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

export default function ReputationalIndicatorsFullForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const full = state.fullData ?? {};

  const [items, setItems] = useState<Indicator[]>(() => {
    const rich = (full.reputationalIndicatorsRich as string[] | undefined) ?? [];
    if (rich.length === 0) return [newIndicator()];
    // try to hydrate basic fields from rich HTML blocks (best-effort)
    return rich.map(html => ({
      ...newIndicator(),
      summaryHtml: html,
    }));
  });

  const bulletLines = useMemo(() => {
    return items
      .map((i) => {
        const match = i.matchType === 'altro' ? (i.matchOther || '').trim() : (i.matchType || '').trim();
        const parts = [
          i.articleAuthor?.trim() ? `Autore: ${i.articleAuthor.trim()}` : null,
          i.articleDate?.trim() ? `Data: ${i.articleDate.trim()}` : null,
          match ? `Match: ${match}` : null,
          i.articleUrl?.trim() ? `Fonte: ${i.articleUrl.trim()}` : null,
          textFromHtml(i.summaryHtml),
        ].filter(Boolean);
        return parts.length ? `- ${parts.join(' | ')}` : '';
      })
      .filter(Boolean);
  }, [items]);

  const richBlocks = useMemo(() => {
    function esc(s: string) {
      return (s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    return items.map((i) => {
      const match = i.matchType === 'altro' ? i.matchOther : i.matchType;
      const header =
        `Secondo l'articolo di ${esc(i.articleAuthor || 'N/A')}` +
        `${i.articleDate ? ` (del ${esc(i.articleDate)})` : ''}` +
        `${match ? ` — match: ${esc(match)}` : ''}` +
        `${i.articleUrl ? ` — fonte: <a href="${esc(i.articleUrl)}">${esc(i.articleUrl)}</a>` : ''}`;
      const safeBody = sanitizeHtmlBasic(i.summaryHtml || '');
      return `<p><strong>${header}</strong></p>${safeBody ? `<div>${safeBody}</div>` : ''}`;
    });
  }, [items]);

  // push into global form state whenever items change
  useEffect(() => {
    updateFullData({
      reputationalIndicators: bulletLines.join('\n'),
      reputationalIndicatorsRich: richBlocks,
    });
    markSectionComplete('reputational-indicators-full', bulletLines.length > 0);
  }, [bulletLines, richBlocks]);

  const updateItem = (id: string, patch: Partial<Indicator>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const addIndicator = () => setItems(prev => [...prev, newIndicator()]);
  const removeIndicator = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Adverse Media — Indicatori Reputazionali</h2>
        <p className="text-gray-600">
          Inserisci per ogni voce i dati di fonte e un riassunto. Puoi formattare il testo e aggiungere hyperlink.
        </p>
      </div>

      <div className="space-y-8">
        {items.map((i) => (
          <div key={i.id} className="border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Autore / Testata</label>
                <input
                  className="w-full px-3 py-2 border rounded-md"
                  value={i.articleAuthor}
                  onChange={(e) => updateItem(i.id, { articleAuthor: e.target.value })}
                  placeholder="Es. La Repubblica / Mario Rossi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Data (GG/MM/AAAA)</label>
                <input
                  className="w-full px-3 py-2 border rounded-md"
                  value={i.articleDate}
                  onChange={(e) => updateItem(i.id, { articleDate: e.target.value })}
                  placeholder="31/07/2025"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">URL Fonte</label>
                <input
                  className="w-full px-3 py-2 border rounded-md"
                  value={i.articleUrl}
                  onChange={(e) => updateItem(i.id, { articleUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo Match</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={i.matchType}
                  onChange={(e) => updateItem(i.id, { matchType: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="positivo">Positivo</option>
                  <option value="negativo">Negativo</option>
                  <option value="neutrale">Neutrale</option>
                  <option value="altro">Altro…</option>
                </select>
                {i.matchType === 'altro' && (
                  <input
                    className="mt-2 w-full px-3 py-2 border rounded-md"
                    placeholder="Specifica il tipo di match"
                    value={i.matchOther}
                    onChange={(e) => updateItem(i.id, { matchOther: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Riassunto (rich text)</label>
              <TiptapEditor
                value={i.summaryHtml}
                onChange={(html) => {
                  const safe = sanitizeHtmlBasic(html);
                  updateItem(i.id, { summaryHtml: safe });
                }}
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <div className="text-xs text-gray-500">
                {textFromHtml(i.summaryHtml).length} caratteri • hyperlink supportati
              </div>
              <button
                type="button"
                onClick={() => removeIndicator(i.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 border rounded-md text-red-600 hover:bg-red-50"
                aria-label="Rimuovi indicatore"
              >
                <Trash2 className="w-4 h-4" /> Rimuovi
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addIndicator}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500"
        >
          <PlusCircle className="w-4 h-4" />
          Aggiungi indicatore
        </button>
      </div>
    </div>
  );
}

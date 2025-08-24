
import React, { useEffect, useState } from 'react';
import { useFormContext } from '../../context/FormContext';
import TiptapEditor from '../../editor/TiptapEditor';
import { Loader2, PlusCircle } from 'lucide-react';
import { generateSummaryAI, AiCtx } from '../../services/aiSummary';

type Indicator = {
  id: string;
  articleUrl: string;
  articleAuthor: string;
  articleDate: string; // string, accepts DD/MM/YYYY or YYYY-MM-DD
  matchType: string;
  matchOther: string;
  inputText: string;    // textbox to summarize
  summaryHtml: string;  // result in HTML (edited with TipTap)
  loading: boolean;
  error: string;
};

const DEFAULT_MATCH = 'corrispondenza definitiva via nome + età + area + foto';

function uid() { return Math.random().toString(36).slice(2, 10); }

function formatDateIT(iso?: string) {
  if (!iso) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT');
}

export default function ReputationalIndicatorsForm() {
  const { state, updateAdverseData, markSectionComplete } = useFormContext();

  const [items, setItems] = useState<Indicator[]>(
    (Array.isArray((state.adverseData as any)?.reputationalIndicatorsItems)
      ? (state.adverseData as any).reputationalIndicatorsItems
      : [
          {
            id: uid(),
            articleUrl: '',
            articleAuthor: '',
            articleDate: '',
            matchType: DEFAULT_MATCH,
            matchOther: '',
            inputText: '',
            summaryHtml: '',
            loading: false,
            error: '',
          },
        ]) as Indicator[]
  );

  // Sync → build plain + rich like v35 and write to store
  useEffect(() => {
    const next = items;

    const bullet = next
      .filter(i => (i.summaryHtml || '').trim() !== '')
      .map(i => {
        const match = (i.matchType || '').trim() === 'Altro'
          ? (i.matchOther || '').trim()
          : (i.matchType || '').trim();
        const header = `Secondo l'articolo di ${i.articleAuthor || 'N/A'} datato ${formatDateIT(i.articleDate)} ${match}`.trim();
        const plain = (i.summaryHtml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return `${header}: ${plain}`;
      });

    const rich = next
      .filter(i => (i.summaryHtml || '').trim() !== '')
      .map(i => {
        const match = (i.matchType || '').trim() === 'Altro'
          ? (i.matchOther || '').trim()
          : (i.matchType || '').trim();
        const header = `Secondo l'articolo di ${i.articleAuthor || 'N/A'} datato ${formatDateIT(i.articleDate)} ${match}`.trim();
        const url = (i.articleUrl || '').trim();
        const link = url ? ` <a href="${url}" target="_blank" rel="noreferrer noopener">${url}</a>` : '';
        const body = (i.summaryHtml || '').trim();
        return `<p><strong>${header}${link}</strong></p><div>${body}</div>`;
      });

    const sources = next
      .filter(i => (i.articleAuthor?.trim() || i.articleUrl?.trim()))
      .map(i => ({ author: (i.articleAuthor || '').trim(), url: (i.articleUrl || '').trim() }));

    updateAdverseData({
      reputationalIndicators: bullet.join('\\n'),
      reputationalIndicatorsRich: rich,
      reputationalIndicatorsItems: next,
      reputationalSources: sources,
    });

    markSectionComplete('reputational-indicators', bullet.length > 0);
  }, [items, updateAdverseData, markSectionComplete]);

  const addItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: uid(),
        articleUrl: '',
        articleAuthor: '',
        articleDate: '',
        matchType: DEFAULT_MATCH,
        matchOther: '',
        inputText: '',
        summaryHtml: '',
        loading: false,
        error: '',
      },
    ]);
  };

  const summarize = async (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, loading: true, error: '' } : it));
    const current = items.find(i => i.id === id);
    if (!current) return;

    if (!current.inputText.trim()) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: 'Inserisci un testo da riassumere.' } : it));
      return;
    }

    try {
      const ctx: AiCtx = { author: current.articleAuthor, articleDate: current.articleDate, matchLabel: current.matchType === 'Altro' ? current.matchOther : current.matchType };
      const summary = await generateSummaryAI(current.inputText, ctx);
      const html = `<p>${summary}</p>`;
      setItems(prev => prev.map(it => it.id === id ? { ...it, summaryHtml: html, loading: false } : it));
    } catch (e: any) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: e?.message || 'Errore durante il riassunto' } : it));
    }
  };

  const updateField = (id: string, patch: Partial<Indicator>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  return (
    <div className="space-y-4">
      {items.map((it, idx) => (
        <div key={it.id} className="border rounded-md p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="input input-bordered" placeholder="Autore (testata)" value={it.articleAuthor} onChange={e => updateField(it.id, { articleAuthor: e.target.value })} />
            <input className="input input-bordered" placeholder="Fonte (URL https://...)" value={it.articleUrl} onChange={e => updateField(it.id, { articleUrl: e.target.value })} />
            <select className="select select-bordered" value={it.matchType} onChange={e => updateField(it.id, { matchType: e.target.value })}>
              <option value={DEFAULT_MATCH}>{DEFAULT_MATCH}</option>
              <option value="corrispondenza probabile via nome + età + area">corrispondenza probabile via nome + età + area</option>
              <option value="Altro">Altro</option>
            </select>
            {it.matchType === 'Altro' && (
              <input className="input input-bordered" placeholder="Specifica 'Altro'..." value={it.matchOther} onChange={e => updateField(it.id, { matchOther: e.target.value })} />
            )}
            <input className="input input-bordered" placeholder="Data articolo (DD/MM/YYYY o YYYY-MM-DD)" value={it.articleDate} onChange={e => updateField(it.id, { articleDate: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm opacity-80">Testo da riassumere (input AI)</label>
            <textarea className="textarea textarea-bordered w-full min-h-[120px]" value={it.inputText} onChange={e => updateField(it.id, { inputText: e.target.value })} />
            <button className="btn btn-primary" onClick={() => summarize(it.id)} disabled={it.loading}>
              {it.loading ? <><Loader2 className="animate-spin w-4 h-4" />&nbsp;Riassumo…</> : <>Riassumi &amp; invia all'editor</>}
            </button>
            {it.error && <p className="text-sm text-red-600">{it.error}</p>}
          </div>

          {it.summaryHtml && (
            <div className="space-y-2">
              <label className="text-sm opacity-80">Riassunto (modificabile)</label>
              <TiptapEditor value={it.summaryHtml} onChange={(html) => updateField(it.id, { summaryHtml: html })} />
            </div>
          )}
        </div>
      ))}

      <div>
        <button className="btn btn-outline flex items-center gap-2" onClick={addItem}>
          <PlusCircle className="w-4 h-4" /> Aggiungi indicatore
        </button>
      </div>
    </div>
  );
}

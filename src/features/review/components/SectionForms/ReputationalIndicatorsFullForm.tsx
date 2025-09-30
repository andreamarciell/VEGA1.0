import React, { useEffect, useState } from 'react';
import { useFormContext } from '../../context/FormContext';
import { FileText, Loader2, PlusCircle } from 'lucide-react';
import TiptapEditor from '../../editor/TiptapEditor';


type Indicator = {
  id: string;
  articleUrl: string;
  articleAuthor: string;
  articleDate: string;
  matchType: string;
  matchOther: string;
  inputText: string;
  summary: string;
  loading: boolean;
  error: string;
};

const DEFAULT_MATCH = 'corrispondenza definitiva via nome + età + area + foto';

function formatDateIT(iso: string | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT');
}

export default function ReputationalIndicatorsFullForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();

  /** Gestione lista indicatori  */
  const [items, setItems] = useState<Indicator[]>([{
    id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10)),
    articleAuthor: '',
    articleUrl: '',
    articleDate: '',
    matchType: DEFAULT_MATCH,
    matchOther: '',
    inputText: '',
    summary: '',
    loading: false,
    error: ''
  }]);

  // hydrate from global store (persisted) if available
  useEffect(() => {
    const saved = (state?.fullData as any)?.reputationalIndicatorsItems;
    if (Array.isArray(saved)) {
      const savedStr = JSON.stringify(saved);
      const localStr = JSON.stringify(items);
      if (savedStr !== localStr) {
        setItems(saved as any);
      }
    }
  }, [state?.fullData?.reputationalIndicatorsItems]);


  /** Ricostruisce la stringa unica da salvare nello store globale  */
  function expandSelectionToWord(range: Range) {
  try {
    let node = range.startContainer;
    let offset = range.startOffset;
    // Se non siamo in un Text node, prova a trovare un text node vicino
    if (node.nodeType !== Node.TEXT_NODE) {
      if (node.childNodes && node.childNodes.length > 0) {
        node = node.childNodes[Math.min(offset, node.childNodes.length - 1)] || node;
      }
    }
    if (node.nodeType !== Node.TEXT_NODE) return false;
    const text = node.textContent || '';
    let start = offset;
    let end = offset;
    while (start > 0 && /[\p{L}\p{N}_]/u.test(text[start - 1])) start--;
    while (end < text.length && /[\p{L}\p{N}_]/u.test(text[end])) end++;
    if (start === end) return false;
    range.setStart(node, start);
    range.setEnd(node, end);
    return true;
  } catch { return false; }
}


const syncWithGlobal = (nextItems: Indicator[]) => {
  const bulletLines = nextItems
    .filter(i => (i.summary ?? '').toString().trim() !== '')
    .map(i => {
      const match = i.matchType === 'altro' ? i.matchOther : i.matchType;
      const header = `Secondo l'articolo di ${i.articleAuthor || 'N/A'} datato ${formatDateIT(i.articleDate)} ${match}`;
      const sanitized = (i.summary ?? '')
        .toString()
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return `${header}: ${sanitized}`;
    });

  const esc = (s: string) => (s || '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[m]);

  const richLines = nextItems
    .filter(i => (i.summary ?? '').toString().trim() !== '')
    .map((i, idx) => {
      const body = (i.summary ?? '').toString().trim();
      // Encode HTML as base64 for Word processing
      const encoded = btoa(unescape(encodeURIComponent(body)));
      return `[[RUN:${idx}]][[DATA:${idx}:${encoded}]]`;
    });

  const sources = nextItems
    .filter(it => ((it.articleAuthor && it.articleAuthor.trim()) || (it.articleUrl && it.articleUrl.trim())))
    .map(it => ({ author: (it.articleAuthor || '').trim(), url: (it.articleUrl || '').trim() }));

  updateFullData({
    reputationalIndicators: bulletLines.join('\n'),
    reputationalIndicatorsRich: richLines,
    reputationalIndicatorsItems: nextItems
  });
  markSectionComplete('reputational-indicators-full', bulletLines.length > 0);
};


  /** Handler per generare il riassunto tramite API */
  const generateSummary = async (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, loading: true, error: '' } : it));

    const current = items.find(i => i.id === id);
    if (!current) return;

    if (!current.inputText.trim()) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: 'Inserisci un testo da riassumere.' } : it));
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/ai-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: current.inputText,
          model: 'mistralai/mistral-small-3.2-24b-instruct:free'
        })
      });
      if (!response.ok) {
        throw new Error('Errore di rete: ' + response.status);
      }
      const json = await response.json();
      const summaryBody = json.summary ?? '';
      
      // Prepend the title to the summary
      const match = current.matchType === 'altro' ? current.matchOther : current.matchType;
      const header = `<p><strong>Secondo l'articolo di ${current.articleAuthor || 'N/A'} datato ${formatDateIT(current.articleDate)} ${match}:</strong></p>`;
      const fullSummary = header + summaryBody;

      setItems(prev => {
        const next = prev.map(it => it.id === id ? { ...it, summary: fullSummary, loading: false } : it);
        // sync with global state after state update
        setTimeout(() => syncWithGlobal(next), 0);
        return next;
      });
    } catch (e: any) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, loading: false, error: e.message || 'Errore' } : it));
    }
  };

  /** Common field updater */
  const updateItem = (id: string, patch: Partial<Indicator>) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, ...patch } : it);
      // keep global store in sync except while loading
      syncWithGlobal(next);
      return next;
    });
  };

  /** Add new blank indicator */
  const addIndicator = () => {
  setItems(prev => [...prev, {
    id: (typeof globalThis !== 'undefined' && (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : Math.random().toString(36).slice(2,10)),
    articleAuthor: '',
    articleUrl: '',
    articleDate: '',
    matchType: DEFAULT_MATCH,
    matchOther: '',
    inputText: '',
    summary: '',
    loading: false,
    error: ''
  }]);
};

  /** Remove indicator by id */
  const removeIndicator = (id: string) => {
    setItems(prev => {
      const next = prev.filter(it => it.id !== id);
      syncWithGlobal(next);
      return next;
    });
  };


  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Indicatori Reputazionali</h2>
        <p className="text-gray-600">Per ogni fonte aggiungi i dati richiesti e genera un riassunto.</p>
      </div>

      <div className="space-y-8">
        {items.map((i, idx) => {
          const matchOtherVisible = i.matchType === 'altro';
          const matchDisplay = i.matchType === 'altro' ? i.matchOther : i.matchType;

          return (
            <div key={i.id} className="space-y-4 border-b pb-6 last:border-b-0">
              <div className="flex items-center justify-between"><h3 className="font-medium text-gray-700">Indicatore #{idx + 1}</h3>{i.summary && i.summary.toString().trim() !== '' ? (<button type="button" onClick={() => removeIndicator(i.id)} className="text-red-600 text-sm hover:underline">Rimuovi</button>) : null}</div>

              {/* Header fields */}
              <div className="flex flex-wrap items-center gap-3">
                <span>Secondo l&apos;articolo di</span>
                
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700">Link all'articolo</label>
                <input
                  type="url"
                  value={i.articleUrl}
                  onChange={(e) => updateItem(i.id, { articleUrl: e.target.value })}
                  placeholder="https://esempio.it/articolo"
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span>datato</span>
                <input
                  type="date"
                  value={i.articleDate}
                  onChange={(e) => updateItem(i.id, { articleDate: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <select
                  value={i.matchType}
                  onChange={(e) => updateItem(i.id, { matchType: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="corrispondenza definitiva via nome + età + area + foto">
                    corrispondenza definitiva via nome + età + area + foto
                  </option>
                  <option value="corrispondenza potenziale via nome + età + area">
                    corrispondenza potenziale via nome + età + area
                  </option>
                  <option value="altro">altro</option>
                </select>

                {matchOtherVisible && (
                  <input
                    type="text"
                    value={i.matchOther}
                    onChange={(e) => updateItem(i.id, { matchOther: e.target.value })}
                    placeholder="Specifica corrispondenza"
                    className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* Textarea for text to summarise */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <FileText className="w-4 h-4" />
                  Testo da Riassumere *
                </label>
                <textarea
                  value={i.inputText}
                  onChange={(e) => updateItem(i.id, { inputText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  rows={8}
                  placeholder="Incolla qui l'articolo o il testo da analizzare..."
                />

                <button
                  type="button"
                  onClick={() => generateSummary(i.id)}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={i.loading}
                >
                  {i.loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Genera Riassunto
                </button>
              </div>

              {/* Output */}
              {i.error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  {i.error}
                </div>
              )}

              

{i.summary && i.summary.toString().trim() !== '' ? (
  <div className="space-y-2">
    <TiptapEditor 
      value={i.summary || ''} 
      onChange={(html) => updateItem(i.id, { summary: html })}
      minHeight="140px"
      placeholder="Inserisci o modifica il riassunto..."
    />
  </div>
) : null}
            </div>
          );
        })}

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
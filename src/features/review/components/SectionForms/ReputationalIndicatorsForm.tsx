
import React, { useEffect, useState } from 'react';
import { useFormContext } from '../../context/FormContext';
import { FileText, Loader2, PlusCircle } from 'lucide-react';
import { Trash2, Link as LinkIcon, Bold, Italic, Underline } from 'lucide-react';

const API_KEY = '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';
// --- Helpers for rich-text handling ---
function htmlToText(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
}

// Minimal inline rich text editor (bold/italic/underline/link)
const RichTextEditor: React.FC<{value: string; onChange: (html: string)=>void}> = ({ value, onChange }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);
  const exec = (cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML || '');
  };
  const onInput = () => onChange(ref.current?.innerHTML || '');
  const addLink = () => {
    const url = window.prompt('Inserisci URL del link:');
    if (url) exec('createLink', url);
  };
  return (
    <div className="border border-gray-300 rounded-lg">
      <div className="flex items-center gap-2 p-2 border-b border-gray-200">
        <button type="button" onClick={() => exec('bold')} className="px-2 py-1 text-sm hover:bg-gray-100 rounded"><strong>B</strong></button>
        <button type="button" onClick={() => exec('italic')} className="px-2 py-1 text-sm hover:bg-gray-100 rounded"><em>I</em></button>
        <button type="button" onClick={() => exec('underline')} className="px-2 py-1 text-sm hover:bg-gray-100 rounded"><u>U</u></button>
        <button type="button" onClick={addLink} className="px-2 py-1 text-sm hover:bg-gray-100 rounded">🔗</button>
        <button type="button" onClick={() => exec('removeFormat')} className="ml-auto px-2 py-1 text-xs hover:bg-gray-100 rounded">Pulisci</button>
      </div>
      <div
        ref={ref}
        onInput={onInput}
        contentEditable
        className="min-h-28 p-3 outline-none"
        spellCheck={false}
      />
    </div>
  );
};


type Indicator = {
  id: string;
  articleUrl: string;
  articleAuthor: string;
  articleDate: string;
  matchType: string;
  matchOther: string;
  inputText: string;
  summary: string;
  summaryHtml?: string;
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

export default function ReputationalIndicatorsForm() {
  const { state, updateAdverseData, markSectionComplete } = useFormContext();

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

  /** Ricostruisce la stringa unica da salvare nello store globale  */
  
  const syncWithGlobal = (nextItems: Indicator[]) => {
    // Build bullet lines from html/text
    const bulletLines = nextItems
      .filter(i => (i.summaryHtml || i.summary).trim() !== '')
      .map(i => {
        const match = i.matchType === 'altro' ? i.matchOther : i.matchType;
        const base = `Secondo l'articolo di ${i.articleAuthor || 'N/A'} datato ${formatDateIT(i.articleDate)} ${match}`;
        const txt = htmlToText(i.summaryHtml || i.summary || '');
        return `${base}: ${txt}`;
      });
    const sources = nextItems
      .filter(it => (it.articleAuthor && it.articleAuthor.trim()) || (it.articleUrl && it.articleUrl.trim()))
      .map(it => ({ author: (it.articleAuthor || '').trim(), url: (it.articleUrl || '').trim() }));
    updateAdverseData({ reputationalIndicators: bulletLines.join('\n'), reputationalSources: sources });
    markSectionComplete('reputational-indicators', bulletLines.length > 0);
  };
 datato ${formatDateIT(i.articleDate)} ${match}`;
      const sanitized = i.summary.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      return `${header}: ${sanitized}`;
    });
    const sources = items
      .filter(it => (it.articleAuthor && it.articleAuthor.trim()) || (it.articleUrl && it.articleUrl.trim()))
      .map(it => ({ author: it.articleAuthor.trim(), url: (it.articleUrl || '').trim() }));
    updateAdverseData({ reputationalIndicators: bulletLines.join('\n'), reputationalSources: sources });
    // Completa se c'è almeno un bullet
    markSectionComplete('reputational-indicators', bulletLines.length > 0);
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
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [
            { role: 'system', content: 'Sei un analista di due diligence incaricato di redigere un riassunto conciso e professionale basato sui risultati di una ricerca di "adverse media". Il riassunto deve essere scritto in un italiano formale e preciso, adatto a un contesto aziendale e di conformità (compliance). L`obiettivo è informare rapidamente i responsabili delle informazioni pertinenti e verificate in modo specifico.' },
            { role: 'user', content: `Riassumi il seguente testo in italiano in modo professionale e conciso, specifico per un adverse media check. Identifica chiaramente il soggetto, il reato, l'esito dei procedimenti penali e lo stato attuale (es. in carcere, in libertà provvisoria) in un unico paragrafo narrativo, senza elenchi o liste. Rispondi solo con il testo del riassunto che sia coinciso ma allo stesso tempo specifico per le informazioni richieste. Inizia il riassunto come un testo descrittivo evitando "questo è il riassunto" o simili.: ${current.inputText}` }
          ],
          temperature: 0.2,
          max_tokens: 300
        })
      });
      if (!response.ok) {
        throw new Error('Errore di rete: ' + response.status);
      }
      const json = await response.json();
      const summary = json.choices?.[0]?.message?.content ?? '';

      setItems(prev => {
        const next = prev.map(it => it.id === id ? { ...it, summary, loading: false } : it);
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
      id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10)),
      articleAuthor: '',
    articleUrl: '',
      articleDate: '',
      matchType: DEFAULT_MATCH,
      matchOther: '',
      inputText: '',
      summary: '',
      loading: false,
      articleUrl: '',
      error: ''
    }]);
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-gray-800">Indicatori Reputazionali</h2>
      <p className="text-gray-600">Per ogni fonte aggiungi i dati richiesti e genera un riassunto.</p>

      {items.map((i, idx) => {
        const matchOtherVisible = i.matchType === 'altro';
        const matchDisplay = i.matchType === 'altro' ? i.matchOther : i.matchType;

        return (
          <div key={i.id} className="space-y-4 border-b pb-6 last:border-b-0 relative">
            <h3 className="font-medium text-gray-700">Indicatore #{idx + 1}</h3>
            <button
              type="button"
              onClick={() => setItems(prev => { const next = prev.filter(x => x.id !== i.id); syncWithGlobal(next); return next; })}
              className="absolute top-0 right-0 text-red-600 hover:text-red-800"
              aria-label="Rimuovi indicatore"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Header fields */}
            <div className="flex flex-wrap items-center gap-3">
              <span>Secondo l&apos;articolo di</span>
              <div className="mt-3">
                <label htmlFor={`author_${i.id}`} className="block text-sm font-medium text-gray-700">Testata</label>
                <input
                  id={`author_${i.id}`}
                  type="text"
                  value={i.articleAuthor}
                  onChange={(e) => updateItem(i.id, { articleAuthor: e.target.value })}
                  placeholder="La Stampa / Il Post / autore..."
                  className="w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

          
              <span>datato</span>
              <label htmlFor={`date_${i.id}`} className="sr-only">Data articolo</label>
              <input id={`date_${i.id}`}
                type="date"
                value={i.articleDate}
                onChange={(e) => updateItem(i.id, { articleDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <label htmlFor={`match_{i.id}`} className="sr-only">Tipo corrispondenza</label>
              <select id={`match_{i.id}`}
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
              <textarea id={`text_${i.id}`}
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

            {(
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-700 mb-2"><strong>{`Secondo l'articolo di ${i.articleAuthor || 'N/A'} datato ${formatDateIT(i.articleDate)} ${matchDisplay}:`}</strong></div>
                <RichTextEditor value={i.summaryHtml || i.summary || ''} onChange={(html)=> {
                  // update html
                  updateItem(i.id, { summaryHtml: html });
                  // bind first hyperlink to source if empty
                  try {
                    const temp = document.createElement('div');
                    temp.innerHTML = html || '';
                    const a = temp.querySelector('a');
                    if (a) {
                      const href = a.getAttribute('href') || '';
                      const label = (a.textContent || '').trim();
                      const current = items.find(x => x.id === i.id);
                      if (current && ((!current.articleUrl || !current.articleUrl.trim()) || (!current.articleAuthor || !current.articleAuthor.trim()))) {
                        updateItem(i.id, { 
                          articleUrl: current.articleUrl && current.articleUrl.trim() ? current.articleUrl : href,
                          articleAuthor: current.articleAuthor && current.articleAuthor.trim() ? current.articleAuthor : label || current.articleAuthor
                        });
                      }
                    }
                  } catch {}
                }} />
              </div>
            )}
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
  );
}

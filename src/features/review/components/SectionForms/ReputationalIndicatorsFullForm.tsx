import React, { useEffect, useState } from 'react';
import { useFormContext } from '../../context/FormContext';
import { FileText, Loader2, PlusCircle } from 'lucide-react';

const API_KEY = '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';

type Indicator = {
  id: string;
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
    // Costruiamo array con header+summary solo quando summary è presente
        const bulletLines = nextItems.filter(i => i.summary.trim() !== '').map(i => {
      const match = i.matchType === 'altro' ? i.matchOther : i.matchType;
      const header = `Secondo l'articolo di ${i.articleAuthor || 'N/A'} datato ${formatDateIT(i.articleDate)} ${match}`;
      const sanitized = i.summary.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
      return `${header}: ${sanitized}`;
    });
    updateFullData({ reputationalIndicators: bulletLines.join('\n') });
    // Completa se c'è almeno un bullet
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
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-small-3.2-24b-instruct:free',
          messages: [
            { role: 'system', content: 'Sei un analista di due diligence incaricato di redigere un riassunto conciso e professionale basato sui risultati di una ricerca di "adverse media". Il riassunto deve essere scritto in un italiano formale e preciso, adatto a un contesto aziendale e di conformità (compliance). L`obiettivo è informare rapidamente i responsabili delle decisioni sui rischi associati a un individuo, evidenziando solo le informazioni pertinenti e verificate.' },
            { role: 'user', content: `Riassumi il seguente testo in italiano in modo professionale e conciso, specifico per un adverse media check. Identifica chiaramente il soggetto, il reato, l'esito dei procedimenti penali e lo stato attuale (es. in carcere, in libertà provvisoria) in un unico paragrafo narrativo, senza elenchi o liste. Rispondi solo con il testo del riassunto che sia il più riassuntivo e coinciso possibile ma allo stesso tempo specifico per le informazioni richieste.: ${current.inputText}` }
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
      articleDate: '',
      matchType: DEFAULT_MATCH,
      matchOther: '',
      inputText: '',
      summary: '',
      loading: false,
      error: ''
    }]);
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
              <h3 className="font-medium text-gray-700">Indicatore #{idx + 1}</h3>

              {/* Header fields */}
              <div className="flex flex-wrap items-center gap-3">
                <span>Secondo l&apos;articolo di</span>
                <input
                  type="text"
                  value={i.articleAuthor}
                  onChange={(e) => updateItem(i.id, { articleAuthor: e.target.value })}
                  placeholder="Autore o testata"
                  className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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

              {i.summary && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg whitespace-pre-wrap">
                  <strong>{`Secondo l'articolo di ${i.articleAuthor || 'N/A'} datato ${formatDateIT(i.articleDate)} ${matchDisplay}:`}</strong>{' '}
                  {i.summary}
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
    </div>
  );
}
import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Shield } from 'lucide-react';

export default function ReputationalIndicatorCheckForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.reputationalIndicatorCheck.trim() !== '';
    markSectionComplete('reputational-indicator-check', isComplete);
  }, [data.reputationalIndicatorCheck]);

  const handleInputChange = (value: string) => {
    updateFullData({ reputationalIndicatorCheck: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Controllo Indicatori Reputazionali</h2>
        <p className="text-gray-600">
          Documenta i controlli effettuati sui media negativi e sugli indicatori reputazionali.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Shield className="w-4 h-4" />
          Dettagli del Controllo *
        </label>
        <textarea
          value={data.reputationalIndicatorCheck}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          rows={12}
          placeholder="Inserisci i dettagli dei controlli reputazionali effettuati:
- Fonti consultate (es. database PEP, sanzioni, media negativi)
- Risultati dei controlli
- Eventuali informazioni negative trovate
- Data e modalità dei controlli
- Valutazione complessiva del rischio reputazionale..."
        />
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800 text-sm">
          ⚠️ <strong>Importante:</strong> Include tutte le fonti consultate e documenta 
          chiaramente qualsiasi informazione negativa trovata, anche se considerata non rilevante.
        </p>
      </div>
    </div>
  );
}
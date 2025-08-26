import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { CheckCircle } from 'lucide-react';

const DEFAULT_TEMPLATE = `XXXXXXX`;

export default function ConclusionRiskLevelForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData;

  // Set default template on component mount
  useEffect(() => {
    if (data.conclusionAndRiskLevel.trim() === '') {
      updateFullData({ conclusionAndRiskLevel: DEFAULT_TEMPLATE });
    }
  }, []);

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.conclusionAndRiskLevel.trim() !== '';
    markSectionComplete('conclusion-risk-level', isComplete);
  }, [data.conclusionAndRiskLevel]);

  const handleInputChange = (value: string) => {
    updateFullData({ conclusionAndRiskLevel: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Conclusione & Livello di Rischio</h2>
        <p className="text-gray-600">
          Inserisci la conclusione della full review e la valutazione del livello di rischio.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <CheckCircle className="w-4 h-4" />
          Conclusione e Valutazione del Rischio *
        </label>
        <textarea
          value={data.conclusionAndRiskLevel}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          rows={12}
          placeholder="Inserisci la conclusione della review"
        />
      </div>


    </div>
  );
}

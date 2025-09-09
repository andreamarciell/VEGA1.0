import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { DollarSign } from 'lucide-react';

export default function SourceOfFundsForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData.sourceOfFunds;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.primary.trim() !== '';
    markSectionComplete('source-of-funds', isComplete);
  }, [data.primary]);

  const handleInputChange = (field: string, value: string) => {
    updateFullData({ sourceOfFunds: { ...data, [field]: value } });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Fonte dei Fondi</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="w-4 h-4" />
            Impiego attuale *
          </label>
          <input
            type="text"
            value={data.primary}
            onChange={(e) => handleInputChange('primary', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="es. Il giocatore in fase di registrazione...."
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Titolarità d’impresa
          </label>
          <input
            type="text"
            value={data.secondary}
            onChange={(e) => handleInputChange('secondary', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Altre fonti di reddito
          </label>
          <textarea
            value={data.documentation}
            onChange={(e) => handleInputChange('documentation', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
            rows={4}
            placeholder="N/A"
          />
        </div>
      </div>

  
    </div>
  );
}

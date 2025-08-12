import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { User, Calendar } from 'lucide-react';

export default function ReviewPerformedByForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.reviewPerformedBy.trim() !== '' && data.reviewDate.trim() !== '';
    markSectionComplete('review-performed-by', isComplete);
  }, [data.reviewPerformedBy, data.reviewDate]);

  const handleInputChange = (field: string, value: string) => {
    updateFullData({ [field]: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Eseguita da & Data</h2>
        <p className="text-gray-600">
          Inserisci chi ha eseguito la review e quando è stata completata.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4" />
            Review Eseguita da *
          </label>
          <input
            type="text"
            value={data.reviewPerformedBy}
            onChange={(e) => handleInputChange('reviewPerformedBy', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Nome e cognome dell'analista"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4" />
            Data *
          </label>
          <input
            type="text"
            value={data.reviewDate}
            onChange={(e) => handleInputChange('reviewDate', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="DD.MM.YYYY"
            pattern="[0-9]{2}\.[0-9]{2}\.[0-9]{4}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formato: DD.MM.YYYY (es. 15.03.2024)
          </p>
        </div>
      </div>
    </div>
  );
}
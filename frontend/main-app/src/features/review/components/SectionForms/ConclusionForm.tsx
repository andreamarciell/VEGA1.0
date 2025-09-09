import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { CheckCircle } from 'lucide-react';

export default function ConclusionForm() {
  const { state, updateAdverseData, markSectionComplete } = useFormContext();
  const data = state.adverseData;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.conclusion.trim() !== '';
    markSectionComplete('conclusion', isComplete);
  }, [data.conclusion]);

  const handleInputChange = (value: string) => {
    updateAdverseData({ conclusion: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Conclusione</h2>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <CheckCircle className="w-4 h-4" />
          Conclusione della Review *
        </label>
        <textarea
          value={data.conclusion}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          rows={10}
          placeholder="Inserisci qui la conclusione basata sui controlli reputazionali effettuati. "
        />
      </div>
    </div>
  );
}

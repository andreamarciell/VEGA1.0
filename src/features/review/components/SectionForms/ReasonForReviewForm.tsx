import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Target } from 'lucide-react';

export default function ReasonForReviewForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.reasonForReview.trim() !== '';
    markSectionComplete('reason', isComplete);
  }, [data.reasonForReview]);

  const handleInputChange = (value: string) => {
    updateFullData({ reasonForReview: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Motivo della Review</h2>
        <p className="text-gray-600">
          Specifica il motivo per cui è stata avviata questa full review.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <Target className="w-4 h-4" />
          Motivo della Review *
        </label>
        <textarea
          value={data.reasonForReview}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          rows={6}
          placeholder="Inserisci il motivo della review."
        />
      </div>


    </div>
  );
}

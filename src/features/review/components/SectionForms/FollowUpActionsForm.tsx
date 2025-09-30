import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { FileCheck } from 'lucide-react';
import TiptapEditor from '../../editor/TiptapEditor';

export default function FollowUpActionsForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.followUpActions.trim() !== '';
    markSectionComplete('follow-up-actions', isComplete);
  }, [data.followUpActions]);

  const handleInputChange = (value: string) => {
    updateFullData({ followUpActions: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Azioni di Follow-up</h2>
        <p className="text-gray-600">
          Specifica le azioni di follow-up necessarie basate sui risultati della review.
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
          <FileCheck className="w-4 h-4" />
          Azioni di Follow-up *
        </label>
        <TiptapEditor
          value={data.followUpActions}
          onChange={handleInputChange}
          minHeight="240px"
          placeholder="Specifica le azioni di follow-up necessarie..."
        />
      </div>

      
    </div>
  );
}

import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Calendar, User } from 'lucide-react';

export default function AgentDateForm() {
  const { state, updateAdverseData, markSectionComplete } = useFormContext();
  const data = state.adverseData;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.agentName.trim() !== '' && data.reviewDate.trim() !== '';
    markSectionComplete('agent-date', isComplete);
  }, [data.agentName, data.reviewDate]);

  const handleInputChange = (field: string, value: string) => {
    updateAdverseData({ [field]: value });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Agente & Data</h2>
        <p className="text-gray-600">
          Inserisci le informazioni dell'agente che ha eseguito la review e la data.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <User className="w-4 h-4" />
            Nome Agente *
          </label>
          <input
            type="text"
            value={data.agentName}
            onChange={(e) => handleInputChange('agentName', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="Inserisci il nome dell'agente"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4" />
            Data Review *
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

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          💡 <strong>Suggerimento:</strong> Assicurati che tutti i campi obbligatori (*) siano compilati correttamente.
          La data deve essere nel formato DD.MM.YYYY.
        </p>
      </div>
    </div>
  );
}
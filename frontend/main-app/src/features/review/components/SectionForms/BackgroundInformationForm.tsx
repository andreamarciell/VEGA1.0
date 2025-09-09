import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Users, Plus, Trash2 } from 'lucide-react';

export default function BackgroundInformationForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData.backgroundInformation;

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.length > 0 && data.some(info => info.source.trim() !== '');
    markSectionComplete('background-information', isComplete);
  }, [data]);

  const handleInfoChange = (index: number, field: string, value: string) => {
    const updatedInfo = [...data];
    updatedInfo[index] = { ...updatedInfo[index], [field]: value };
    updateFullData({ backgroundInformation: updatedInfo });
  };

  const addInfo = () => {
    const newInfo = { source: '', type: '', additionalInfo: '' };
    updateFullData({ backgroundInformation: [...data, newInfo] });
  };

  const removeInfo = (index: number) => {
    const updatedInfo = data.filter((_, i) => i !== index);
    updateFullData({ backgroundInformation: updatedInfo });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Informazioni di Background</h2>
        <p className="text-gray-600">
          Inserisci informazioni aggiuntive raccolte durante la review da fonti esterne.
        </p>
      </div>

      <div className="space-y-4">
        {data.map((info, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Fonte
                </label>
                <input
                  type="text"
                  value={info.source}
                  onChange={(e) => handleInfoChange(index, 'source', e.target.value)}
                  placeholder="Fonte"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Tipo
                </label>
                <select
                  value={info.type}
                  onChange={(e) => handleInfoChange(index, 'type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Seleziona tipo</option>
                  <option value="Link">Link</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => removeInfo(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Informazioni Aggiuntive
              </label>
              <textarea
                value={info.additionalInfo}
                onChange={(e) => handleInfoChange(index, 'additionalInfo', e.target.value)}
                placeholder="Informazioni aggiuntive..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
        ))}

        <button
          onClick={addInfo}
          className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Aggiungi Informazione di Background
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-800 text-sm">
          💡 <strong>Suggerimento:</strong> Inserisci le informazioni di background raccolte durante la review.
        </p>
      </div>
    </div>
  );
}
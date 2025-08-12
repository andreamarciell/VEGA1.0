
import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Plus, Trash2 } from 'lucide-react';

const TYPES = ['slot', 'casino live', 'poker', 'lotterie', 'sportsbook', 'altro'];

export default function AdditionalActivityForm() {
  const { state, updateFullData, markSectionComplete } = useFormContext();
  const data = state.fullData.additionalActivity;

  useEffect(() => {
    markSectionComplete('additional-activity', data.length > 0 && data.some(a => a.type));
  }, [data]);

  const handleChange = (index: number, field: string, value: string) => {
    const copy = [...data];
    copy[index] = { ...copy[index], [field]: value };
    updateFullData({ additionalActivity: copy });
  };

  const addRow = () => updateFullData({ additionalActivity: [...data, { type:'', additionalInfo:'' }] });
  const removeRow = (i: number) => updateFullData({ additionalActivity: data.filter((_, idx) => idx !== i) });

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Aggiungi Attività</h2>
      <div className="space-y-3">
        {data.map((row, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-3 items-center">
            <select
              value={row.type}
              onChange={(e) => handleChange(idx, 'type', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Tipo</option>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              value={row.additionalInfo}
              onChange={(e) => handleChange(idx, 'additionalInfo', e.target.value)}
              placeholder="Informazioni aggiuntive"
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button onClick={() => removeRow(idx)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg">
          <Plus className="w-4 h-4" /> Aggiungi riga
        </button>
      </div>
    </div>
  );
}

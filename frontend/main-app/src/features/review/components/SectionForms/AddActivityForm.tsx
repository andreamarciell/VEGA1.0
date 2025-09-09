import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { PlusCircle, Trash2 } from 'lucide-react';
import { safeArray } from '../../utils/safeArray';

const TYPES = ['slot', 'casino live', 'poker', 'lotterie', 'sportsbook', 'altro'];

const AddActivityForm: React.FC = () => {
  const { state, updateFullData, markSectionComplete } = useFormContext();

  const data = safeArray(state?.fullData?.additionalActivities);

  useEffect(() => {
    const complete = data.some((d) => typeof d?.type === 'string' && d.type.trim() !== '');
    markSectionComplete('add-activity', complete);
  }, [data]);

  const handleChange = (index: number, field: string, value: string) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    updateFullData({ additionalActivities: updated });
  };

  const addRow = () =>
    updateFullData({ additionalActivities: [...data, { type: '', additionalInfo: '' }] });

  const removeRow = (index: number) =>
    updateFullData({ additionalActivities: data.filter((_, i) => i !== index) });

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Gameplay</h2>
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="grid md:grid-cols-3 gap-3 items-center">
            <select
              value={item?.type ?? ''}
              onChange={(e) => handleChange(index, 'type', e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Seleziona tipo</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <textarea
              rows={3}
              value={item?.additionalInfo ?? ''}
              onChange={(e) => handleChange(index, 'additionalInfo', e.target.value)}
              placeholder="Informazioni aggiuntive"
              className="px-3 py-2 border rounded-lg text-sm resize-none"
            />
            <button onClick={() => removeRow(index)} className="text-red-600 p-2">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button onClick={addRow} className="flex items-center gap-2 border-2 border-dashed px-4 py-3 rounded-lg">
          <PlusCircle className="w-4 h-4" /> Aggiungi riga
        </button>
      </div>
    </div>
  );
};

export default AddActivityForm;

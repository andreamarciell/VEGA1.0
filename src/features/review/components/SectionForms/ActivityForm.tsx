import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Plus, Trash2 } from 'lucide-react';
import { safeArray } from '../../utils/safeArray';

const ActivityForm: React.FC = () => {
  const { state, updateFullData, markSectionComplete } = useFormContext();

  const data = safeArray(state?.fullData?.thirdPartyPaymentMethods ?? state?.fullData?.activities);

  useEffect(() => {
    const complete = data.some((d) => typeof d?.type === 'string' && d.type.trim() !== '');
    markSectionComplete('activity', complete);
  }, [data]);

  const handleChange = (index: number, field: string, value: string) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    updateFullData({ thirdPartyPaymentMethods: updated });
  };

  const addRow = () =>
    updateFullData({ thirdPartyPaymentMethods: [...data, { nameNumber: '', type: '', additionalInfo: '' }] });

  const removeRow = (index: number) =>
    updateFullData({ thirdPartyPaymentMethods: data.filter((_, i) => i !== index) });

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6">Terze Parti</h2>
      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="grid md:grid-cols-4 gap-3 items-center">
            <input
              value={item?.nameNumber ?? ''}
              onChange={(e) => handleChange(index, 'nameNumber', e.target.value)}
              placeholder="Nome/Numero"
              className="px-3 py-2 border rounded-lg text-sm"
            />
            <input
              value={item?.type ?? ''}
              onChange={(e) => handleChange(index, 'type', e.target.value)}
              placeholder="Tipo"
              className="px-3 py-2 border rounded-lg text-sm"
            />
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
          <Plus className="w-4 h-4" /> Aggiungi Terza Parte
        </button>
      </div>
    </div>
  );
};

export default ActivityForm;

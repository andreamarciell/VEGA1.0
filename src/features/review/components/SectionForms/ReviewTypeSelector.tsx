import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { FileSearch, FileText } from 'lucide-react';

export default function ReviewTypeSelector() {
  const { state, dispatch } = useFormContext();

  const handleSelectReviewType = (type: 'adverse' | 'full') => {
    dispatch({ type: 'SET_REVIEW_TYPE', payload: type });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Seleziona Tipo di Review</h2>
      <p className="text-gray-600 mb-8">
        Scegli il tipo di review che vuoi completare. Questa scelta determinerà i campi e le sezioni disponibili.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <button
          onClick={() => handleSelectReviewType('adverse')}
          className={`p-8 border-2 rounded-xl transition-all duration-200 text-left ${
            state.reviewType === 'adverse'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-lg ${
              state.reviewType === 'adverse' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <FileSearch className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Adverse Media Review</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Recensione focalizzata sui controlli reputazionali e sui media negativi.
            Include profilo cliente, indicatori reputazionali e conclusioni.
          </p>
        </button>

        <button
          onClick={() => handleSelectReviewType('full')}
          className={`p-8 border-2 rounded-xl transition-all duration-200 text-left ${
            state.reviewType === 'full'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-lg ${
              state.reviewType === 'full' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Full Review</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Recensione completa che include analisi dettagliata dell'attività, metodi di pagamento,
            fonte dei fondi e valutazione del rischio.
          </p>
        </button>
      </div>

      {state.reviewType && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">
            ✓ Hai selezionato: <strong>
              {state.reviewType === 'adverse' ? 'Adverse Media Review' : 'Full Review'}
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}
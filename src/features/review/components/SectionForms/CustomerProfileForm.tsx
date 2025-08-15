import React, { useEffect } from 'react';
import { useFormContext } from '../../context/FormContext';
import { User, Plus, Trash2, Calendar } from 'lucide-react';

export default function CustomerProfileForm() {
  const { state, updateAdverseData, updateFullData, markSectionComplete } = useFormContext();
  
  const data = state.reviewType === 'adverse' 
    ? state.adverseData.customerProfile 
    : state.fullData.customerProfile;

  const sectionId = state.reviewType === 'adverse' ? 'customer-profile' : 'customer-profile-full';

  // Check if section is complete
  useEffect(() => {
    const isComplete = data.registrationDate.trim() !== '' && 
                      data.age.trim() !== '' && 
                      data.nationality.trim() !== '';
    markSectionComplete(sectionId, isComplete);
  }, [data.registrationDate, data.age, data.nationality, sectionId]);

  const handleInputChange = (field: string, value: string) => {
    const update = { customerProfile: { ...data, [field]: value } };
    if (state.reviewType === 'adverse') {
      updateAdverseData(update);
    } else {
      updateFullData(update);
    }
  };

  const handleDocumentChange = (index: number, field: string, value: string) => {
    const updatedDocuments = [...data.documentsSent];
    updatedDocuments[index] = { ...updatedDocuments[index], [field]: value };
    
    const update = { customerProfile: { ...data, documentsSent: updatedDocuments } };
    if (state.reviewType === 'adverse') {
      updateAdverseData(update);
    } else {
      updateFullData(update);
    }
  };

  const addDocument = () => {
    const updatedDocuments = [...data.documentsSent, { document: '', status: '', info: '' }];
    const update = { customerProfile: { ...data, documentsSent: updatedDocuments } };
    if (state.reviewType === 'adverse') {
      updateAdverseData(update);
    } else {
      updateFullData(update);
    }
  };

  const removeDocument = (index: number) => {
    const updatedDocuments = data.documentsSent.filter((_, i) => i !== index);
    const update = { customerProfile: { ...data, documentsSent: updatedDocuments } };
    if (state.reviewType === 'adverse') {
      updateAdverseData(update);
    } else {
      updateFullData(update);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Profilo Cliente</h2>
        <p className="text-gray-600">
          Inserisci le informazioni dettagliate del profilo del cliente.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4" />
            Data di Registrazione *
          </label>
          <input
            type="text"
            value={data.registrationDate}
            onChange={(e) => handleInputChange('registrationDate', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            placeholder="DD.MM.YYYY"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Documenti Inviati
          </label>
          <div className="space-y-3">
            {data.documentsSent.map((doc, index) => (

              <div key={index} className="flex gap-3 items-start flex-col md:flex-row">
                {/* Tipo documento */}
                <select
                  value={doc.document}
                  onChange={(e) => handleDocumentChange(index, 'document', e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleziona tipo</option>
                  <option value="carta d'identità">Carta d'identità</option>
                  <option value="patente">Patente</option>
                  <option value="passaporto">Passaporto</option>
                  <option value="altro">Altro</option>
                  <option value="n/a">n/a</option>
                </select>

                {/* Stato */}
                <select
                  value={doc.status}
                  onChange={(e) => handleDocumentChange(index, 'status', e.target.value)}
                  className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Stato</option>
                  <option value="valido">Valido</option>
                  <option value="respinto">Respinto</option>
                  <option value="scaduto">Scaduto</option>
                  <option value="stand-by">Stand‑by</option>
                  <option value="n/a">n/a</option>
                </select>

                {/* Informazioni aggiuntive */}
                <textarea
                   value={doc.info}
                   onChange={(e) => handleDocumentChange(index, 'info', e.target.value)}
                   className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-24 resize-y"
                   placeholder="Informazioni aggiuntive" rows={3}></textarea>

                <button
                  onClick={() => removeDocument(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={addDocument}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Documento
            </button>
          </div>
        </div>

        {state.reviewType === 'adverse' ? (
          <div className="grid md:grid-cols-1 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Primo Deposito
              </label>
              <textarea
                value={data.firstDeposit}
                onChange={(e) => handleInputChange('firstDeposit', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-28 resize-y"
                placeholder="Scrivi dettagli sul primo deposito"
                rows={4}
              ></textarea>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Totale Depositato
              </label>
              <input
                type="text"
                value={data.totalDeposited}
                onChange={(e) => handleInputChange('totalDeposited', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="€ 0.00"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Totale Prelevato
              </label>
              <input
                type="text"
                value={data.totalWithdrawn}
                onChange={(e) => handleInputChange('totalWithdrawn', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="€ 0.00"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Saldo
              </label>
              <input
                type="text"
                value={data.balance}
                onChange={(e) => handleInputChange('balance', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="€ 0.00"
              />
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Età *
            </label>
            <input
              type="text"
              value={data.age}
              onChange={(e) => handleInputChange('age', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Nazionalità *
            </label>
            <input
              type="text"
              value={data.nationality}
              onChange={(e) => handleInputChange('nationality', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="es. Italiana"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Luogo di Nascita
            </label>
            <input
              type="text"
              value={data.birthplace}
              onChange={(e) => handleInputChange('birthplace', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="es. Roma, Italia"
            />
          </div>
        </div>

        {state.reviewType === 'adverse' ? (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Ultimo Login
            </label>
            <input
              type="text"
              value={data.latestLogin}
              onChange={(e) => handleInputChange('latestLogin', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="DD.MM.YYYY"
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Tentativi di Accesso
              </label>
              <input
                type="text"
                value={data.accessAttempts}
                onChange={(e) => handleInputChange('accessAttempts', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Numero tentativi"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Attività tra le 22 e le 6
              </label>
              <input
                type="text"
                value={data.activityBetween22And6}
                onChange={(e) => handleInputChange('activityBetween22And6', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Descrizione attività"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Storico Conti
              </label>
              <input
                type="text"
                value={data.accountHistory}
                onChange={(e) => handleInputChange('accountHistory', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Informazioni storico"
              />
            </div>
          </div>
        )}

        {state.reviewType === 'adverse' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                IP Login
              </label>
              <input
                type="text"
                value={data.latestLoginIP}
                onChange={(e) => handleInputChange('latestLoginIP', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="es. 192.168.0.1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Nazionalità Login
              </label>
              <select
                value={data.latestLoginNationality}
                onChange={(e) => { const v = e.target.value; handleInputChange(\'latestLoginNationality\', v); }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Seleziona</option>
                <option value="Italiano">Italiano</option>
                <option value="Altro">Altro</option>
              </select>
              {data.latestLoginNationality === 'Altro' && (
                <input
                  type="text"
                  onChange={(e) => { const v = e.target.value; handleInputChange(\'latestLoginNationality\', v); }}
                  className="w-full mt-2 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Inserisci nazionalità"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
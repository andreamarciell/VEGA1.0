import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { Download, FileText, Check, AlertCircle } from 'lucide-react';
import { exportToDocx } from '../../export/exportDocx';

interface ExportSummaryProps {
  onComplete?: (docxBlob: Blob) => void;
}

export default function ExportSummary({ onComplete }: ExportSummaryProps) {
  const { state } = useFormContext();

  const handleExport = async () => {
    try {
      const blob = await exportToDocx(state);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      a.href = url;
      a.download = `${state.reviewType === 'adverse' ? 'Adverse_Media_Review' : 'Full_Review'}_${dateStr}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (onComplete) {
        onComplete(blob);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert("Errore durante l'esportazione del documento. Riprova.");
    }
  };

  const getCompletionStats = () => {
    const totalSections = Object.keys(state.completedSections).length;
    const completedSections = Object.values(state.completedSections).filter(Boolean).length;
    return { total: totalSections, completed: completedSections };
  };

  const stats = getCompletionStats();

  const renderSummarySection = (title: string, data: any) => {
    const hasData =
      typeof data === 'string'
        ? data.trim() !== ''
        : typeof data === 'object' && data !== null
        ? Object.values(data).some((val: any) =>
            typeof val === 'string'
              ? val.trim() !== ''
              : Array.isArray(val)
              ? val.length > 0
              : val !== null && val !== undefined
          )
        : false;

    return (
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {hasData ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-500" />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5" /> Sommario esportazione DOCX
      </h2>

      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Sezioni completate: <strong>{stats.completed}/{stats.total}</strong>
        </p>
      </div>

      {/* Summary by Review Type */}
      <div className="space-y-4 mb-8">
        {state.reviewType === 'adverse' ? (
          <>
            {renderSummarySection('Agente & Data', {
              agent: state.adverseData.agentName,
              date: state.adverseData.reviewDate
            })}
            {renderSummarySection('Profilo Cliente', state.adverseData.customerProfile)}
            {renderSummarySection('Indicatori Reputazionali', state.adverseData.reputationalIndicators)}
            {renderSummarySection('Conclusione', state.adverseData.conclusion)}
          </>
        ) : (
          <>
            {renderSummarySection('Motivo della Review', state.fullData.reasonForReview)}
            {renderSummarySection('Review Eseguita da & Data', {
              performedBy: state.fullData.reviewPerformedBy,
              date: state.fullData.reviewDate
            })}
            {renderSummarySection('Profilo Cliente', state.fullData.customerProfile)}
            {renderSummarySection('Metodi di Pagamento', state.fullData.paymentMethods)}
            {renderSummarySection('Metodi di Pagamento di Terzi', state.fullData.thirdPartyPaymentMethods)}
            {renderSummarySection('Attività Aggiuntive', state.fullData.additionalActivities)}
            {renderSummarySection('Fonte dei Fondi', state.fullData.sourceOfFunds)}
            {renderSummarySection('Indicatori Reputazionali', state.fullData.reputationalIndicators)}
            {renderSummarySection('Conclusione & Livello di Rischio', state.fullData.conclusionAndRiskLevel)}
            {renderSummarySection('Azioni di Follow-up', state.fullData.followUpActions)}
            {renderSummarySection('Informazioni di Background', state.fullData.backgroundInformation)}
          </>
        )}
      </div>

      {/* Export Button */}
      <div className="text-center">
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-3 px-8 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Download className="w-5 h-5" />
          Esporta Documento DOCX
        </button>
      </div>
    </div>
  );
}

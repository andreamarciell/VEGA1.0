
import React from 'react';
import { useFormContext } from '../../context/FormContext';
import { Download } from 'lucide-react';
import { downloadDocx } from '../../utils/docx';

export default function ExportSummary() {
  const { state } = useFormContext();

  const handleExport = async () => {
    await downloadDocx(state);
  };

  return (
    <div className="text-center">
      <button onClick={handleExport} className="inline-flex items-center gap-3 px-8 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
        <Download className="w-5 h-5" />
        Esporta Documento DOCX
      </button>
    </div>
  );
}

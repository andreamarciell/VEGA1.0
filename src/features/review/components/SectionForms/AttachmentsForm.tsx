import React, { useRef } from 'react';
import { useFormContext } from '../../context/FormContext';
import { Image as ImageIcon, Trash2 } from 'lucide-react';

export default function AttachmentsForm() {
  const { state, updateAdverseData, updateFullData, markSectionComplete } = useFormContext();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const attachments = state.reviewType === 'adverse'
    ? (state.adverseData.attachments || [])
    : (state.fullData.attachments || []);

  function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const promises: Promise<{ name: string; dataUrl: string }>[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      promises.push(new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, dataUrl: String(reader.result) });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }));
    });

    Promise.all(promises).then((list) => {
      const next = [...attachments, ...list];
      if (state.reviewType === 'adverse') {
        updateAdverseData({ attachments: next });
      } else {
        updateFullData({ attachments: next });
      }
      markSectionComplete('attachments', next.length > 0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  }

  function removeAt(index: number) {
    const next = attachments.filter((_, i) => i !== index);
    if (state.reviewType === 'adverse') {
      updateAdverseData({ attachments: next });
    } else {
      updateFullData({ attachments: next });
    }
    markSectionComplete('attachments', next.length > 0);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">Allegati immagine</h2>
  
      <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 bg-white">
        <ImageIcon className="w-8 h-8 text-gray-500" />
        <label htmlFor="attachments_input" className="sr-only">Carica immagini</label>
        <input
          id="attachments_input"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onFilesSelected(e.target.files)}
          className="block"
        />
        <p className="text-xs text-gray-500">PNG, JPG o WEBP. Dimensione consigliata: larghezza 800–1200px.</p>
      </div>

      {attachments.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative border rounded-md overflow-hidden bg-white">
              <img src={att.dataUrl} alt={att.name} className="w-full h-40 object-cover" />
              <div className="p-2 text-sm truncate">{att.name}</div>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-white/90 hover:bg-white p-1 shadow"
                aria-label="Rimuovi immagine"
                title="Rimuovi"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

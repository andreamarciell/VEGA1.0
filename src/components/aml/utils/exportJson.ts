/* --------------------------------------------------------------------
 * Utility: exportJsonFile
 * Serializza un oggetto in JSON pretty‑printed e innesca il download
 * di un file <filename>.json nel browser. 100% Vanilla, nessuna dip. esterna
 * ------------------------------------------------------------------ */
export function exportJsonFile (data: unknown, filename: string = 'toppery-aml.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
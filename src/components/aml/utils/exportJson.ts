/**
 * Serializza i dati ricevuti come JSON e avvia il download del file.
 *
 * @param data - Oggetto da esportare
 * @param filename - Nome del file risultante (default: toppery-aml.json)
 */
export function exportJsonFile(data: unknown, filename = 'toppery-aml.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });

  // download "vanilla" senza dipendenze esterne
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { AmlResults, AmlTransaction } from '../AmlDashboard';
import { analyzeTransactions } from '../utils/amlAnalysis';

interface FileUploadProps {
  onAnalysisComplete: (results: AmlResults, transactions: AmlTransaction[]) => void;
}

export const FileUpload = ({ onAnalysisComplete }: FileUploadProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('Seleziona un file Excel (.xlsx o .xls)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const processExcelFile = async (file: File): Promise<AmlTransaction[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Use the exact same parsing as the original giasai repository
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

          setProgress(50);

          console.log('Raw Excel data:', jsonData.slice(0, 3)); // Debug log

          // Exact mapping following the original giasai logic
          const transactions: AmlTransaction[] = jsonData.map((row: any, index: number) => {
            console.log(`Processing row ${index}:`, row); // Debug log
            
            // Handle date with multiple possible formats
            let parsedDate: Date = new Date();
            const dateValue = row['Data'] || row['data'] || row['Date'] || row['Timestamp'] || row['DATA'] || row['TIMESTAMP'];
            
            if (dateValue) {
              if (dateValue instanceof Date) {
                parsedDate = dateValue;
              } else if (typeof dateValue === 'string') {
                // Parse date string in Italian format dd/mm/yyyy or other formats
                if (dateValue.includes('/')) {
                  const parts = dateValue.split('/');
                  if (parts.length === 3) {
                    const day = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1; // Month is 0-indexed
                    const year = parseInt(parts[2]);
                    parsedDate = new Date(year, month, day);
                  }
                } else if (dateValue.includes('-')) {
                  parsedDate = new Date(dateValue);
                } else {
                  // Try to parse as timestamp or other format
                  const parsed = Date.parse(dateValue);
                  if (!isNaN(parsed)) {
                    parsedDate = new Date(parsed);
                  }
                }
              } else if (typeof dateValue === 'number') {
                // Excel serial date
                parsedDate = new Date((dateValue - 25569) * 86400 * 1000);
              }
            }

            // Handle causale/description
            const causale = row['Causale'] || row['causale'] || row['Description'] || row['Descrizione'] || 
                          row['CAUSALE'] || row['DESCRIPTION'] || row['Dettaglio'] || row['dettaglio'] || 
                          row['Desc'] || row['desc'] || '';
            
            // Handle amount with various possible column names and formats
            const importoRaw = row['Importo'] || row['importo'] || row['Amount'] || row['amount'] || 
                             row['Valore'] || row['valore'] || row['IMPORTO'] || row['AMOUNT'] || 
                             row['Euro'] || row['euro'] || row['ImportoEuro'] || row['IMPORTOEURO'] || 
                             row['Totale'] || row['totale'] || '0';
            
            let importo = 0;
            
            if (typeof importoRaw === 'number') {
              importo = Math.abs(importoRaw);
            } else if (typeof importoRaw === 'string' && importoRaw.trim()) {
              // Clean the string: remove currency symbols, spaces, and handle commas
              let cleanAmount = importoRaw.trim()
                .replace(/€/g, '')
                .replace(/EUR/g, '')
                .replace(/\s+/g, '')
                .replace(/\./g, '') // Remove thousands separators
                .replace(',', '.'); // Convert decimal comma to dot
              
              importo = Math.abs(parseFloat(cleanAmount) || 0);
            }

            const transaction = {
              data: parsedDate,
              causale: String(causale).trim(),
              importo: importo,
              importo_raw: String(importoRaw),
              dataStr: parsedDate.toLocaleDateString('it-IT')
            };

            console.log(`Created transaction:`, transaction); // Debug log
            return transaction;
          }).filter(tx => {
            const isValid = tx.importo > 0 && tx.causale && !isNaN(tx.data.getTime());
            console.log(`Transaction valid: ${isValid}`, tx); // Debug log
            return isValid;
          });

          console.log(`Total valid transactions: ${transactions.length}`); // Debug log
          setProgress(75);
          resolve(transactions);
        } catch (error) {
          console.error('Excel processing error:', error);
          reject(new Error('Errore durante la lettura del file Excel: ' + (error as Error).message));
        }
      };

      reader.onerror = () => reject(new Error('Errore durante la lettura del file'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error('Seleziona prima un file');
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      toast.info('Analisi in corso...');
      
      // Process Excel file
      const transactions = await processExcelFile(selectedFile);
      
      if (transactions.length === 0) {
        throw new Error('Nessuna transazione valida trovata nel file');
      }

      setProgress(80);

      // Perform AML analysis
      const results = analyzeTransactions(transactions);
      
      setProgress(100);
      
      // Complete analysis
      onAnalysisComplete(results, transactions);
      
    } catch (error) {
      console.error('Errore durante l\'analisi:', error);
      toast.error(error instanceof Error ? error.message : 'Errore durante l\'analisi');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!selectedFile ? (
        <Card 
          className="border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer p-12"
          onClick={handleUploadClick}
        >
          <div className="text-center">
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Clicca per selezionare un file Excel</p>
            <p className="text-sm text-muted-foreground">Formati supportati: .xlsx, .xls</p>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleUploadClick} disabled={isProcessing}>
                Cambia File
              </Button>
              <Button onClick={handleAnalyze} disabled={isProcessing}>
                {isProcessing ? 'Analizzando...' : 'Analizza'}
              </Button>
            </div>
          </div>
          
          {isProcessing && (
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                Elaborazione in corso... {progress}%
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
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
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/mm/yyyy' });

          setProgress(50);

          // Map Excel data to our transaction format
          const transactions: AmlTransaction[] = jsonData.map((row: any) => {
            // Try different possible column names for date
            const dateValue = row['Data'] || row['data'] || row['Date'] || row['Timestamp'];
            let parsedDate: Date;
            
            if (dateValue instanceof Date) {
              parsedDate = dateValue;
            } else if (typeof dateValue === 'string') {
              // Try parsing different date formats
              if (dateValue.includes('/')) {
                const [day, month, year] = dateValue.split('/');
                parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              } else {
                parsedDate = new Date(dateValue);
              }
            } else {
              parsedDate = new Date();
            }

            // Try different possible column names for description/causale
            const causale = row['Causale'] || row['causale'] || row['Description'] || row['Descrizione'] || '';
            
            // Try different possible column names for amount
            const importoRaw = row['Importo'] || row['importo'] || row['Amount'] || row['Valore'] || '0';
            let importo = 0;
            
            if (typeof importoRaw === 'number') {
              importo = importoRaw;
            } else if (typeof importoRaw === 'string') {
              // Clean the string and parse
              const cleanAmount = importoRaw.replace(/[€\s,]/g, '').replace(',', '.');
              importo = parseFloat(cleanAmount) || 0;
            }

            return {
              data: parsedDate,
              causale: String(causale),
              importo: Math.abs(importo), // Use absolute value for analysis
              importo_raw: String(importoRaw),
              dataStr: parsedDate.toLocaleDateString('it-IT')
            };
          }).filter(tx => tx.importo > 0); // Filter out zero amounts

          setProgress(75);
          resolve(transactions);
        } catch (error) {
          reject(new Error('Errore durante la lettura del file Excel'));
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
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentSession } from '@/lib/auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { AnalysisResults } from './components/AnalysisResults';
import { toast } from 'sonner';

export interface AmlTransaction {
  data: Date;
  causale: string;
  importo: number;
  importo_raw?: string;
  dataStr?: string;
}

export interface AmlResults {
  riskLevel: 'Low' | 'Medium' | 'High';
  riskScore: number;
  motivations: string[];
  frazionate: Array<{
    start: string;
    end: string;
    total: number;
    transactions: AmlTransaction[];
  }>;
  patterns: string[];
  alerts: string[];
  sessions?: Array<{
    timestamp: string;
  }>;
}

const AmlDashboard = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<AmlResults | null>(null);
  const [transactions, setTransactions] = useState<AmlTransaction[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const session = await getCurrentSession();
      if (!session) {
        navigate('/auth/login');
        return;
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleFileAnalyzed = (analysisResults: AmlResults, txData: AmlTransaction[]) => {
    setResults(analysisResults);
    setTransactions(txData);
    toast.success('Analisi completata con successo');
  };

  const handleReset = () => {
    setResults(null);
    setTransactions([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna al Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Toppery AML</h1>
            <p className="text-muted-foreground">Sistema di analisi anti-riciclaggio e rilevamento frodi</p>
          </div>
        </div>

        {!results ? (
          /* File Upload Section */
          <Card className="p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Carica File Excel</h2>
              <p className="text-muted-foreground mb-6">
                Carica un file Excel (.xlsx) contenente i dati delle transazioni per iniziare l'analisi AML
              </p>
              <FileUpload onAnalysisComplete={handleFileAnalyzed} />
            </div>
          </Card>
        ) : (
          /* Analysis Results Section */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Risultati Analisi</h2>
              <Button onClick={handleReset} variant="outline">
                Nuova Analisi
              </Button>
            </div>
            <AnalysisResults results={results} transactions={transactions} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AmlDashboard;
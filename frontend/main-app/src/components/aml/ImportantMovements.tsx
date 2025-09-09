import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Calendar, Euro } from 'lucide-react';

interface Transaction {
  data?: Date;
  date?: Date;
  Data?: Date;
  dataStr?: string;
  causale?: string;
  Causale?: string;
  importo?: number;
  amount?: number;
  Importo?: number;
  ImportoEuro?: number;
  importo_raw?: string;
  importoRaw?: string;
  rawAmount?: string;
  amountRaw?: string;
  TSN?: string;
  "TS extension"?: string;
  "TS Extension"?: string;
  "ts extension"?: string;
  "TS_extension"?: string;
  TSExtension?: string;
}

interface ImportantMovementsProps {
  transactions: Transaction[];
}

export const ImportantMovements: React.FC<ImportantMovementsProps> = ({ transactions }) => {
  const [selectedTSN, setSelectedTSN] = useState<string | null>(null);

  const importantMovements = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const toDate = (tx: Transaction) => new Date(tx.data || tx.date || tx.Data || tx.dataStr || 0);
    const sortedTx = [...transactions].sort((a, b) => toDate(a).getTime() - toDate(b).getTime());

    const amountAbs = (tx: Transaction) => Math.abs(tx.importo ?? tx.amount ?? tx.Importo ?? tx.ImportoEuro ?? 0);
    const amountSigned = (tx: Transaction) => Number(tx.importo ?? tx.amount ?? tx.Importo ?? tx.ImportoEuro ?? 0);
    const isWithdrawal = (tx: Transaction) => /prelievo/i.test(tx.causale || tx.Causale || '');
    const isSession = (tx: Transaction) => /(session|scommessa)/i.test(tx.causale || tx.Causale || '');

    const top = (arr: Transaction[]) => arr.sort((a, b) => amountAbs(b) - amountAbs(a)).slice(0, 5);
    const importantList = [...top(sortedTx.filter(isWithdrawal)), ...top(sortedTx.filter(isSession))];

    const seen = new Set();
    const important = importantList.filter(tx => {
      const key = (tx.dataStr || '') + (tx.causale || '') + amountAbs(tx);
      return !seen.has(key) && seen.add(key);
    });

    const movements: Array<{
      importantTx: Transaction;
      context: Transaction[];
    }> = [];

    important.forEach(tx => {
      const idx = sortedTx.indexOf(tx);
      const start = Math.max(0, idx - 5);
      const end = Math.min(sortedTx.length, idx + 6);
      const context = sortedTx.slice(start, end);
      movements.push({ importantTx: tx, context });
    });

    return movements;
  }, [transactions]);

  const formatAmount = (tx: Transaction) => {
    const rawStr = (tx.importo_raw ?? tx.importoRaw ?? tx.rawAmount ?? tx.amountRaw ?? '').toString().trim();
    if (rawStr) return rawStr;
    
    const amount = Number(tx.importo ?? tx.amount ?? tx.Importo ?? tx.ImportoEuro ?? 0);
    return amount.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (tx: Transaction) => {
    const date = tx.dataStr || tx.date || tx.data || tx.Data;
    if (typeof date === 'string') return date;
    if (date instanceof Date) return date.toLocaleDateString('it-IT');
    return '';
  };

  const getTSN = (tx: Transaction) => {
    return tx.TSN || tx["TS extension"] || tx["TS Extension"] || tx["ts extension"] || tx["TS_extension"] || tx.TSExtension || '';
  };

  const handleTSNClick = (tsn: string) => {
    setSelectedTSN(tsn);
    // Open in new window as in original code
    window.open(`https://starvegas-gest.admiralbet.it/DettaglioGiocataSlot.asp?GameSessionID=${encodeURIComponent(tsn)}`, '_blank');
  };

  if (!transactions || transactions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold">Movimenti Importanti</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessuna transazione disponibile per l'analisi</p>
            <p className="text-sm">Carica i file delle transazioni per visualizzare i movimenti importanti</p>
          </div>
        </div>
      </Card>
    );
  }

  if (importantMovements.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold">Movimenti Importanti</h3>
        </div>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessun movimento importante trovato</p>
            <p className="text-sm">Non sono stati identificati prelievi o sessioni di gioco significative</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold">Movimenti Importanti</h3>
        <div className="ml-auto text-sm text-muted-foreground">
          {importantMovements.length} movimenti identificati
        </div>
      </div>

      <div className="space-y-6">
        {importantMovements.map((movement, index) => (
          <div key={index} className="border rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 px-4 py-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">
                    {formatDate(movement.importantTx)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Euro className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {formatAmount(movement.importantTx)} €
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {movement.importantTx.causale || movement.importantTx.Causale}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border border-border p-2 text-left font-medium">Data</th>
                    <th className="border border-border p-2 text-left font-medium">Causale</th>
                    <th className="border border-border p-2 text-left font-medium">TSN</th>
                    <th className="border border-border p-2 text-right font-medium">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {movement.context.map((tx, idx) => {
                    const isImportant = tx === movement.importantTx;
                    const tsn = getTSN(tx);
                    
                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-muted/30 transition-colors ${
                          isImportant ? 'bg-green-50 dark:bg-green-950/20 border-l-4 border-l-green-500' : ''
                        }`}
                      >
                        <td className="border border-border p-2">
                          {formatDate(tx)}
                        </td>
                        <td className="border border-border p-2">
                          {tx.causale || tx.Causale}
                        </td>
                        <td className="border border-border p-2">
                          {tsn ? (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                              onClick={() => handleTSNClick(tsn)}
                            >
                              {tsn}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="border border-border p-2 text-right font-mono">
                          {formatAmount(tx)} €
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

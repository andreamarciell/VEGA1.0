
import { useState } from "react";
import { useParseTransactions } from "@/hooks/useParseTransactions";
import MovementsTable from "@/components/aml/MovementsTable";
import CardsTable from "@/components/aml/CardsTable";
import { useTransactionStore } from "@/store/transactionStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const AmlDashboard = () => {
  const { transactionResults, setTransactionResults, reset } = useTransactionStore();
  const { parseAll } = useParseTransactions();

  const [activeTab, setActiveTab] = useState<"transazioni" | "accessi">("transazioni");
  const [depositFile, setDepositFile] = useState<File | null>(null);
  const [withdrawFile, setWithdrawFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [includeCards, setIncludeCards] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    const res = await parseAll({
      deposits: depositFile,
      withdrawals: withdrawFile,
      cards: includeCards ? cardFile : null,
    });
    setTransactionResults(res);
    setLoading(false);
  };

  const handleReset = () => {
    reset();
    setDepositFile(null);
    setWithdrawFile(null);
    setCardFile(null);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Toppery AML</h1>
        <Button variant="outline" onClick={handleReset}>
          Nuova Analisi
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-4">
        <Button variant={activeTab === "transazioni" ? "default" : "secondary"} onClick={() => setActiveTab("transazioni")}>
          Transazioni
        </Button>
        <Button variant={activeTab === "accessi" ? "default" : "secondary"} onClick={() => setActiveTab("accessi")}>
          Accessi
        </Button>
      </div>

      {activeTab === "transazioni" && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">File Depositi</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setDepositFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">File Prelievi</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setWithdrawFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">File Carte</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setCardFile(e.target.files?.[0] ?? null)} />
              <div className="flex items-center gap-2 mt-1">
                <Checkbox checked={includeCards} onCheckedChange={(c) => setIncludeCards(Boolean(c))} id="includeCards"/>
                <label htmlFor="includeCards" className="text-sm">Includi Transazioni Carte</label>
              </div>
            </div>
          </div>

          <Button className="mt-4" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analisi in corso..." : "Analizza Transazioni"}
          </Button>

          {/* Results */}
          {transactionResults?.deposits && (
            <MovementsTable title="Depositi" data={transactionResults.deposits} />
          )}
          {transactionResults?.withdrawals && (
            <MovementsTable title="Prelievi" data={transactionResults.withdrawals} />
          )}
          {includeCards && transactionResults?.cards && (
            <CardsTable data={transactionResults.cards} />
          )}
        </div>
      )}

      {activeTab === "accessi" && (
        <div>
          <p>Funzionalità Accessi non ancora migrata.</p>
        </div>
      )}
    </div>
  );
};

export default AmlDashboard;

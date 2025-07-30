import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AmlResults, AmlTransaction } from '../AmlDashboard';
import { RiskCard } from './RiskCard';
import { AlertsCard } from './AlertsCard';
import { FrazionateCard } from './FrazionateCard';
import { PatternsCard } from './PatternsCard';
import { SessionsChart } from './SessionsChart';
import { CausaliChart } from './CausaliChart';

interface AnalysisResultsProps {
  results: AmlResults;
  transactions: AmlTransaction[];
}

export const AnalysisResults = ({ results, transactions }: AnalysisResultsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Risk Assessment */}
      <div className="lg:col-span-2">
        <RiskCard riskLevel={results.riskLevel} riskScore={results.riskScore} />
      </div>

      {/* Motivations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Motivazioni Analisi</h3>
        <ul className="space-y-2">
          {results.motivations.map((motivation, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="h-2 w-2 bg-primary rounded-full mt-2 flex-shrink-0" />
              <span className="text-sm">{motivation}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Alerts */}
      <AlertsCard alerts={results.alerts} />

      {/* Frazionate */}
      {results.frazionate.length > 0 && (
        <div className="lg:col-span-2">
          <FrazionateCard frazionate={results.frazionate} />
        </div>
      )}

      {/* Patterns */}
      {results.patterns.length > 0 && (
        <PatternsCard patterns={results.patterns} />
      )}

      {/* Causali Distribution */}
      <div className="lg:col-span-2">
        <CausaliChart transactions={transactions} />
      </div>

      {/* Sessions Analysis */}
      {results.sessions && results.sessions.length > 0 && (
        <div className="lg:col-span-2">
          <SessionsChart sessions={results.sessions} />
        </div>
      )}
    </div>
  );
};
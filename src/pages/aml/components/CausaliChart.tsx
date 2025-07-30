import { Card } from '@/components/ui/card';
import { PieChart } from 'lucide-react';
import { AmlTransaction } from '../AmlDashboard';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CausaliChartProps {
  transactions: AmlTransaction[];
}

function normalizeCausale(causale: string): string {
  if (!causale) return 'Sconosciuto';
  const lc = causale.toLowerCase().trim();
  
  // Session Slot: distingue le versioni Live
  if (lc.startsWith('session slot') || lc.startsWith('sessione slot')) {
    return lc.includes('(live') ? 'Session Slot (Live)' : 'Session Slot';
  }
  
  return causale;
}

export const CausaliChart = ({ transactions }: CausaliChartProps) => {
  // Count occurrences of each causale
  const causaleCount: { [key: string]: number } = {};
  
  transactions.forEach(tx => {
    const key = normalizeCausale(tx.causale);
    causaleCount[key] = (causaleCount[key] || 0) + 1;
  });

  const labels = Object.keys(causaleCount);
  const data = Object.values(causaleCount);

  // Generate colors for each segment
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
    '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56'
  ];

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: labels.map((_, i) => colors[i % colors.length]),
        borderColor: labels.map((_, i) => colors[i % colors.length]),
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw;
            const total = data.reduce((sum, num) => sum + num, 0);
            const percentage = total ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-green-500" />
        <h3 className="text-lg font-semibold">Distribuzione Causali</h3>
      </div>

      {transactions.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Nessuna transazione disponibile
        </p>
      ) : (
        <div className="space-y-4">
          {/* Pie Chart */}
          <div className="h-80">
            <Pie data={chartData} options={chartOptions} />
          </div>

          {/* Summary Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Causale</th>
                  <th className="text-right py-2">Occorrenze</th>
                  <th className="text-right py-2">Percentuale</th>
                </tr>
              </thead>
              <tbody>
                {labels.map((label, index) => {
                  const count = causaleCount[label];
                  const total = data.reduce((sum, num) => sum + num, 0);
                  const percentage = total ? ((count / total) * 100).toFixed(1) : '0.0';
                  
                  return (
                    <tr key={index} className="border-b border-muted">
                      <td className="py-2">{label}</td>
                      <td className="text-right py-2">{count}</td>
                      <td className="text-right py-2">{percentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
};
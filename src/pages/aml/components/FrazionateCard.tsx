import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown } from 'lucide-react';
import { AmlResults } from '../AmlDashboard';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface FrazionateCardProps {
  frazionate: AmlResults['frazionate'];
}

export const FrazionateCard = ({ frazionate }: FrazionateCardProps) => {
  const chartData = {
    labels: frazionate.map(f => `${f.start} → ${f.end}`),
    datasets: [
      {
        label: 'Totale Frazionate (€)',
        data: frazionate.map(f => f.total),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderWidth: 2,
        fill: false,
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return '€' + value.toLocaleString();
          },
        },
      },
    },
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Operazioni Frazionate</h3>
        <Badge variant="secondary">{frazionate.length}</Badge>
      </div>

      {frazionate.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Nessuna frazionata rilevata
        </p>
      ) : (
        <div className="space-y-6">
          {/* Timeline Chart */}
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>

          {/* Detailed List */}
          <div className="space-y-4">
            {frazionate.map((f, index) => (
              <div key={index} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">Periodo: {f.start} → {f.end}</p>
                    <p className="text-lg font-bold text-primary">
                      Totale: €{f.total.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {f.transactions.length} movimenti
                  </Badge>
                </div>
                
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-muted-foreground">
                    Mostra movimenti
                  </summary>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {f.transactions.map((tx, txIndex) => (
                      <div key={txIndex} className="text-xs p-2 bg-muted rounded">
                        <span className="font-mono">
                          {tx.dataStr} | {tx.causale} | €{tx.importo.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
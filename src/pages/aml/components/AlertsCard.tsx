import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AlertsCardProps {
  alerts: string[];
}

export const AlertsCard = ({ alerts }: AlertsCardProps) => {
  // Parse alerts to categorize them
  const parseAlerts = () => {
    const categories: { [key: string]: number } = {
      'Velocity deposit': 0,
      'Bonus concentration': 0,
      'Casino live': 0
    };

    alerts.forEach(alert => {
      const type = alert.split(':')[0];
      if (categories.hasOwnProperty(type)) {
        categories[type]++;
      }
    });

    return categories;
  };

  const alertCategories = parseAlerts();
  
  const chartData = {
    labels: Object.keys(alertCategories),
    datasets: [
      {
        label: 'Numero di Alert',
        data: Object.values(alertCategories),
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 205, 86, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        <h3 className="text-lg font-semibold">Anomalie AML / Fraud</h3>
        <Badge variant="secondary">{alerts.length}</Badge>
      </div>

      {alerts.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Nessuna anomalia rilevata
        </p>
      ) : (
        <div className="space-y-4">
          {/* Summary Chart */}
          <div className="h-48">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Category Summary */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            {Object.entries(alertCategories).map(([category, count]) => (
              <div key={category} className="text-center">
                <div className="font-medium">{category}</div>
                <div className="text-muted-foreground">{count} occorrenze</div>
              </div>
            ))}
          </div>

          {/* Detailed Alerts */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Mostra dettagli ({alerts.length} alert)
            </summary>
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
              {alerts.map((alert, index) => (
                <Alert key={index} className="text-xs">
                  <AlertDescription>{alert}</AlertDescription>
                </Alert>
              ))}
            </div>
          </details>
        </div>
      )}
    </Card>
  );
};
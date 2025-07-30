import { Card } from '@/components/ui/card';
import { Clock } from 'lucide-react';
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

interface SessionsChartProps {
  sessions: Array<{ timestamp: string }>;
}

export const SessionsChart = ({ sessions }: SessionsChartProps) => {
  // Create hourly heatmap
  const hourMap = new Array(24).fill(0);
  
  sessions.forEach(session => {
    const hour = new Date(session.timestamp).getHours();
    hourMap[hour]++;
  });

  // Calculate night sessions percentage
  const nightSessions = sessions.filter(session => {
    const hour = new Date(session.timestamp).getHours();
    return hour >= 22 || hour < 6;
  });
  
  const nightPercentage = sessions.length > 0 
    ? ((nightSessions.length / sessions.length) * 100).toFixed(1)
    : '0.0';

  const chartData = {
    labels: [...Array(24).keys()].map(h => h + ':00'),
    datasets: [
      {
        label: 'Sessioni per ora',
        data: hourMap,
        backgroundColor: hourMap.map((_, index) => {
          const hour = index;
          if (hour >= 22 || hour < 6) {
            return 'rgba(255, 99, 132, 0.8)'; // Night hours in red
          }
          return 'rgba(54, 162, 235, 0.8)'; // Day hours in blue
        }),
        borderColor: hourMap.map((_, index) => {
          const hour = index;
          if (hour >= 22 || hour < 6) {
            return 'rgba(255, 99, 132, 1)';
          }
          return 'rgba(54, 162, 235, 1)';
        }),
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
        display: true,
        text: 'Distribuzione Oraria delle Sessioni',
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const hour = context.dataIndex;
            const count = context.raw;
            const isNight = hour >= 22 || hour < 6;
            return `${count} sessioni${isNight ? ' (orario notturno)' : ''}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Ora del giorno',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Numero di sessioni',
        },
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Analisi Sessioni Orarie</h3>
      </div>

      <div className="space-y-4">
        {/* Night Sessions Stats */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm">
            <span className="font-medium">{nightPercentage}%</span> delle sessioni 
            sono tra le 22:00 e le 06:00
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Sessioni notturne: {nightSessions.length} / {sessions.length} totali
          </p>
        </div>

        {/* Hourly Heatmap */}
        <div className="h-64">
          <Bar data={chartData} options={chartOptions} />
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span>Orario diurno (06:00-22:00)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Orario notturno (22:00-06:00)</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
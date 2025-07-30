import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Shield, ShieldAlert } from 'lucide-react';

interface RiskCardProps {
  riskLevel: 'Low' | 'Medium' | 'High';
  riskScore: number;
}

export const RiskCard = ({ riskLevel, riskScore }: RiskCardProps) => {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Low':
        return 'bg-green-500 text-white';
      case 'Medium':
        return 'bg-orange-500 text-white';
      case 'High':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'Low':
        return <Shield className="h-8 w-8" />;
      case 'Medium':
        return <ShieldAlert className="h-8 w-8" />;
      case 'High':
        return <AlertTriangle className="h-8 w-8" />;
      default:
        return <Shield className="h-8 w-8" />;
    }
  };

  return (
    <Card className="p-8">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className={`p-4 rounded-full ${getRiskColor(riskLevel)}`}>
            {getRiskIcon(riskLevel)}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold mb-2">Valutazione del Rischio</h2>
        
        <Badge 
          className={`text-lg px-6 py-2 ${getRiskColor(riskLevel)}`}
        >
          {riskLevel === 'Low' && 'Rischio Basso'}
          {riskLevel === 'Medium' && 'Rischio Medio'}
          {riskLevel === 'High' && 'Rischio Alto'}
        </Badge>
        
        <div className="mt-4">
          <p className="text-muted-foreground">Score di Rischio</p>
          <p className="text-3xl font-bold">{riskScore}/100</p>
        </div>
        
        <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${
              riskLevel === 'Low' ? 'bg-green-500' :
              riskLevel === 'Medium' ? 'bg-orange-500' : 'bg-red-500'
            }`}
            style={{ width: `${riskScore}%` }}
          />
        </div>
      </div>
    </Card>
  );
};
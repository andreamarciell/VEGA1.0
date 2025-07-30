import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

interface PatternsCardProps {
  patterns: string[];
}

export const PatternsCard = ({ patterns }: PatternsCardProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Pattern AML Sospetti</h3>
        <Badge variant="secondary">{patterns.length}</Badge>
      </div>

      {patterns.length === 0 ? (
        <p className="text-muted-foreground text-center py-4">
          Nessun pattern sospetto rilevato
        </p>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern, index) => (
            <div key={index} className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{pattern}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
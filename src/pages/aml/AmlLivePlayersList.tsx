import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface PlayerRisk {
  account_id: string;
  nick: string;
  first_name: string;
  last_name: string;
  domain: string | null;
  current_balance: number | null;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Elevato';
}

const AmlLivePlayersList = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerRisk[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerRisk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPlayers();
  }, []);

  useEffect(() => {
    // Filtra giocatori in base al termine di ricerca
    if (!searchTerm.trim()) {
      setFilteredPlayers(players);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredPlayers(
        players.filter(
          p =>
            p.nick.toLowerCase().includes(term) ||
            p.first_name.toLowerCase().includes(term) ||
            p.last_name.toLowerCase().includes(term) ||
            p.account_id.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, players]);

  const fetchPlayers = async () => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTIONS_URL || '';
      const url = `${baseUrl}/.netlify/functions/getPlayersList`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setPlayers(data.players || []);
      setFilteredPlayers(data.players || []);
    } catch (error) {
      console.error('Error fetching players:', error);
      toast.error(error instanceof Error ? error.message : 'Errore nel caricamento dei giocatori');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'Low':
        return 'default';
      case 'Medium':
        return 'secondary';
      case 'High':
        return 'destructive';
      case 'Elevato':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'Low':
        return 'bg-green-500';
      case 'Medium':
        return 'bg-yellow-500';
      case 'High':
        return 'bg-orange-500';
      case 'Elevato':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleViewDetails = (accountId: string) => {
    // Apre in nuova tab
    const url = `/toppery-aml-live/${accountId}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Torna al Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">TopperyAML Live</h1>
            <p className="text-muted-foreground">Lista giocatori con analisi rischio in tempo reale</p>
          </div>
        </div>

        {/* Search and Refresh */}
        <Card className="p-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nick, nome, cognome o account ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={fetchPlayers} disabled={isLoading} variant="outline">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Caricamento...
                </>
              ) : (
                'Aggiorna'
              )}
            </Button>
          </div>
        </Card>

        {/* Players Table */}
        {isLoading ? (
          <Card className="p-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Caricamento giocatori...</span>
            </div>
          </Card>
        ) : filteredPlayers.length === 0 ? (
          <Card className="p-8">
            <div className="text-center text-muted-foreground">
              {searchTerm ? 'Nessun giocatore trovato per la ricerca' : 'Nessun giocatore disponibile'}
            </div>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account ID</TableHead>
                  <TableHead>Nick</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cognome</TableHead>
                  <TableHead>Dominio</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Livello Rischio</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.map((player) => (
                  <TableRow key={player.account_id}>
                    <TableCell className="font-mono text-sm">{player.account_id}</TableCell>
                    <TableCell className="font-medium">{player.nick}</TableCell>
                    <TableCell>{player.first_name}</TableCell>
                    <TableCell>{player.last_name}</TableCell>
                    <TableCell>{player.domain || '-'}</TableCell>
                    <TableCell>
                      {player.current_balance !== null
                        ? `€${player.current_balance.toFixed(2)}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getRiskBadgeVariant(player.risk_level)}
                        className={getRiskBadgeColor(player.risk_level)}
                      >
                        {player.risk_level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{player.risk_score}</span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(player.account_id)}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Dettagli
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Summary */}
        {!isLoading && players.length > 0 && (
          <Card className="p-4 mt-6">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Totale giocatori: </span>
                <span className="font-semibold">{players.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Rischio Elevato: </span>
                <span className="font-semibold text-red-500">
                  {players.filter(p => p.risk_level === 'Elevato').length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rischio High: </span>
                <span className="font-semibold text-orange-500">
                  {players.filter(p => p.risk_level === 'High').length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rischio Medium: </span>
                <span className="font-semibold text-yellow-500">
                  {players.filter(p => p.risk_level === 'Medium').length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Rischio Low: </span>
                <span className="font-semibold text-green-500">
                  {players.filter(p => p.risk_level === 'Low').length}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AmlLivePlayersList;

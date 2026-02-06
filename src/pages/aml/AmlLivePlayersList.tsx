import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, ExternalLink, Loader2, Folder, FolderOpen, ChevronLeft, ChevronRight } from 'lucide-react';
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
  status?: 'active' | 'reviewed' | 'escalated' | 'archived' | 'high-risk' | 'critical-risk';
}

type Category = 'all' | 'high-risk' | 'critical-risk' | 'reviewed' | 'escalated' | 'archived';

const AmlLivePlayersList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [players, setPlayers] = useState<PlayerRisk[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<PlayerRisk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Leggi la categoria dall'URL - se non presente, mostra le cartelle
  const currentCategory = searchParams.get('category') as Category | null;
  const showCategories = !currentCategory; // Mostra cartelle se non c'è categoria selezionata

  useEffect(() => {
    fetchPlayers();
  }, []);

  // Filtra giocatori in base alla categoria e al termine di ricerca
  useEffect(() => {
    if (!currentCategory) {
      setFilteredPlayers([]);
      return;
    }

    let filtered = [...players];

    // Filtra per categoria - ora usa status anche per high-risk e critical-risk
    switch (currentCategory) {
      case 'high-risk':
        filtered = filtered.filter(p => p.status === 'high-risk');
        break;
      case 'critical-risk':
        filtered = filtered.filter(p => p.status === 'critical-risk');
        break;
      case 'reviewed':
        filtered = filtered.filter(p => p.status === 'reviewed');
        break;
      case 'escalated':
        filtered = filtered.filter(p => p.status === 'escalated');
        break;
      case 'archived':
        filtered = filtered.filter(p => p.status === 'archived');
        break;
      case 'all':
      default:
        // Mostra tutti i giocatori
        break;
    }

    // Filtra per termine di ricerca
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        p =>
          (p.nick || '').toLowerCase().includes(term) ||
          (p.first_name || '').toLowerCase().includes(term) ||
          (p.last_name || '').toLowerCase().includes(term) ||
          String(p.account_id || '').toLowerCase().includes(term)
      );
    }

    setFilteredPlayers(filtered);
    setCurrentPage(1); // Reset pagina quando cambia filtro
  }, [currentCategory, searchTerm, players]);

  // Calcola giocatori paginati
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredPlayers.slice(startIndex, endIndex);
  }, [filteredPlayers, currentPage]);

  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);

  const fetchPlayers = async () => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTIONS_URL || '';
      const url = `${baseUrl}/.netlify/functions/getPlayersList`;
      
      console.log('Fetching players from:', url);
      
      // Timeout più lungo per BigQuery (60 secondi)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: 'Unknown error',
          message: `HTTP ${response.status}: ${response.statusText}`
        }));
        
        console.error('Error response:', errorData);
        
        // Mostra sia error che message se disponibili
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
        const errorType = errorData.type ? ` (${errorData.type})` : '';
        
        throw new Error(`${errorMessage}${errorType}`);
      }

      const data = await response.json();
      console.log('Players data received:', data);
      console.log('Number of players:', data.players?.length || 0);
      
      setPlayers(data.players || []);
    } catch (error) {
      console.error('Error fetching players:', error);
      let errorMessage = 'Errore nel caricamento dei giocatori';
      
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
          errorMessage = 'Timeout: il caricamento sta richiedendo più tempo del previsto. Riprova.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
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

  const handleCategoryChange = (category: Category) => {
    setSearchParams({ category });
  };

  const handleBackToCategories = () => {
    setSearchParams({});
    setSearchTerm('');
  };

  const handleStatusChange = async (accountId: string, newStatus: 'reviewed' | 'escalated' | 'archived' | 'active' | 'high-risk' | 'critical-risk') => {
    try {
      const baseUrl = import.meta.env.VITE_NETLIFY_FUNCTIONS_URL || '';
      const url = `${baseUrl}/.netlify/functions/updatePlayerStatus`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          account_id: accountId,
          status: newStatus
        })
      });

      if (!response.ok) {
        throw new Error('Errore nell\'aggiornamento dello status');
      }

      // Aggiorna lo stato locale
      setPlayers(prev => prev.map(p => 
        p.account_id === accountId ? { ...p, status: newStatus } : p
      ));

      toast.success('Status aggiornato con successo');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Errore nell\'aggiornamento dello status');
    }
  };

  const handleViewDetails = (accountId: string) => {
    // Apre in nuova tab
    const url = `/toppery-aml-live/${accountId}`;
    window.open(url, '_blank');
  };

  // Calcola conteggi per ogni categoria - ora usa status anche per high-risk e critical-risk
  const categoryCounts = useMemo(() => {
    return {
      all: players.length,
      'high-risk': players.filter(p => p.status === 'high-risk').length,
      'critical-risk': players.filter(p => p.status === 'critical-risk').length,
      reviewed: players.filter(p => p.status === 'reviewed').length,
      escalated: players.filter(p => p.status === 'escalated').length,
      archived: players.filter(p => p.status === 'archived').length,
    };
  }, [players]);

  const categories: Array<{ id: Category; label: string; icon: React.ReactNode }> = [
    { id: 'all', label: 'Tutti gli utenti', icon: <Folder className="h-4 w-4" /> },
    { id: 'high-risk', label: 'High Risk', icon: <Folder className="h-4 w-4" /> },
    { id: 'critical-risk', label: 'Critical Risk', icon: <Folder className="h-4 w-4" /> },
    { id: 'reviewed', label: 'Account Revisionati', icon: <Folder className="h-4 w-4" /> },
    { id: 'escalated', label: 'Account Escalati', icon: <Folder className="h-4 w-4" /> },
    { id: 'archived', label: 'Account Archiviati', icon: <Folder className="h-4 w-4" /> },
  ];

  // Nome della categoria corrente
  const currentCategoryLabel = currentCategory 
    ? categories.find(c => c.id === currentCategory)?.label 
    : '';

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
            <p className="text-muted-foreground">
              {showCategories 
                ? 'Seleziona una cartella per visualizzare i giocatori'
                : currentCategoryLabel}
            </p>
          </div>
        </div>

        {/* Search and Refresh - sempre visibile */}
        <Card className="p-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nick, nome, cognome o account ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={showCategories} // Disabilita la ricerca quando si vedono le cartelle
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
            {!showCategories && (
              <Button 
                variant="outline" 
                onClick={handleBackToCategories}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Torna alle cartelle
              </Button>
            )}
          </div>
        </Card>

        {/* Vista Cartelle - mostra solo quando non c'è categoria selezionata */}
        {showCategories && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => {
              const count = categoryCounts[category.id];
              
              return (
                <Card
                  key={category.id}
                  className="p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                  onClick={() => handleCategoryChange(category.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Folder className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-lg mb-1">{category.label}</div>
                      <div className="text-sm text-muted-foreground">
                        {count} {count === 1 ? 'giocatore' : 'giocatori'}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Vista Lista Giocatori - mostra solo quando c'è una categoria selezionata */}
        {!showCategories && (
          <>
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
                  {searchTerm 
                    ? 'Nessun giocatore trovato per la ricerca' 
                    : `Nessun giocatore nella categoria "${currentCategoryLabel}"`}
                </div>
              </Card>
            ) : (
              <>
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
                        <TableHead>Status</TableHead>
                        <TableHead>Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPlayers.map((player) => (
                        <TableRow key={player.account_id}>
                          <TableCell className="font-mono text-sm">{player.account_id}</TableCell>
                          <TableCell className="font-medium">{player.nick}</TableCell>
                          <TableCell>{player.first_name}</TableCell>
                          <TableCell>{player.last_name}</TableCell>
                          <TableCell>{player.domain || '-'}</TableCell>
                          <TableCell>
                            {player.current_balance !== null && player.current_balance !== undefined
                              ? `€${Number(player.current_balance).toFixed(2)}`
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
                            <select
                              value={player.status || 'active'}
                              onChange={(e) => {
                                const newStatus = e.target.value as 'reviewed' | 'escalated' | 'archived' | 'active' | 'high-risk' | 'critical-risk';
                                handleStatusChange(player.account_id, newStatus);
                              }}
                              className="text-sm border rounded px-2 py-1 bg-background"
                            >
                              <option value="active">Attivo</option>
                              <option value="high-risk">High Risk</option>
                              <option value="critical-risk">Critical Risk</option>
                              <option value="reviewed">Revisionato</option>
                              <option value="escalated">Escalato</option>
                              <option value="archived">Archiviato</option>
                            </select>
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

                {/* Paginazione */}
                {totalPages > 1 && (
                  <Card className="p-4 mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredPlayers.length)} di {filteredPlayers.length} giocatori
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Precedente
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Pagina {currentPage} di {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Successiva
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AmlLivePlayersList;

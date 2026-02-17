import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import {
  Shield,
  MessageSquare,
  RefreshCw,
  Paperclip,
  BarChart3,
  Activity,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface TenantKPIs {
  totalComments: number;
  statusChanges: number;
  attachmentsCount: number;
}

interface AuditActivity {
  id: string;
  date: string;
  agent: string;
  actionType: string;
  playerId: string;
  link: string | null;
  content?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  comment: "Commento",
  status_change: "Cambio status",
  attachment: "Allegato",
  attachment_upload: "Allegato caricato",
  auto_retrigger: "Re-trigger automatico",
  api_ingest: "API Ingest",
};

const AdminControl = () => {
  const { orgId } = useAuth();
  const { user } = useUser();
  const [kpis, setKpis] = useState<TenantKPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [audit, setAudit] = useState<AuditActivity[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [usernames, setUsernames] = useState<string[]>([]);
  const [usernameFilter, setUsernameFilter] = useState<string>("");
  const [auditError, setAuditError] = useState<string | null>(null);

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.primaryEmailAddress?.emailAddress ?? "Admin";

  useEffect(() => {
    const fetchKpis = async () => {
      if (!orgId) return;
      try {
        setKpisLoading(true);
        const res = await api.get("/api/v1/admin/tenant/kpis");
        if (!res.ok) throw new Error("Failed to load KPIs");
        const data = await res.json();
        setKpis(data);
      } catch (e) {
        console.error("Error fetching KPIs:", e);
        toast({
          title: "Errore",
          description: "Impossibile caricare i KPI operativi",
          variant: "destructive",
        });
      } finally {
        setKpisLoading(false);
      }
    };
    fetchKpis();
  }, [orgId]);

  useEffect(() => {
    const fetchUsernames = async () => {
      if (!orgId) return;
      try {
        const res = await api.get("/api/v1/admin/tenant/audit/usernames");
        if (!res.ok) return;
        const data = await res.json();
        setUsernames(data.usernames ?? []);
      } catch {
        // optional: filter dropdown can stay empty
      }
    };
    fetchUsernames();
  }, [orgId]);

  useEffect(() => {
    const fetchAudit = async () => {
      if (!orgId) return;
      setAuditLoading(true);
      setAuditError(null);
      try {
        const params = new URLSearchParams();
        if (usernameFilter) params.set("username", usernameFilter);
        params.set("limit", "100");
        const res = await api.get(`/api/v1/admin/tenant/audit?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load audit trail");
        const data = await res.json();
        setAudit(data.activities ?? []);
      } catch (e) {
        console.error("Error fetching audit:", e);
        setAuditError("Impossibile caricare l'attività.");
        setAudit([]);
      } finally {
        setAuditLoading(false);
      }
    };
    fetchAudit();
  }, [orgId, usernameFilter]);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Monitoraggio Operativo Tenant</h1>
                <p className="text-sm text-muted-foreground">
                  Benvenuto, {displayName}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              <Activity className="w-3 h-3 mr-1" />
              Soft Admin
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="kpis" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2">
            <TabsTrigger value="kpis" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              KPI Operativi
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Attività
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kpis" className="space-y-6">
            <h2 className="text-2xl font-bold">Operational KPI Dashboard</h2>
            {kpisLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : kpis ? (
              <div className="grid gap-6 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Commenti totali team
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis.totalComments}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Status modificati
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis.statusChanges}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Documenti allegati
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{kpis.attachmentsCount}</div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nessun dato KPI disponibile.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-2xl font-bold">Audit Trail</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Username</span>
                <Select
                  value={usernameFilter || "all"}
                  onValueChange={(v) => setUsernameFilter(v === "all" ? "" : v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tutti gli agenti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli agenti</SelectItem>
                    {usernames.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {auditError && (
              <p className="text-sm text-destructive">{auditError}</p>
            )}

            {auditLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Agente</TableHead>
                      <TableHead>Tipo azione</TableHead>
                      <TableHead>ID Giocatore</TableHead>
                      <TableHead className="text-right">Link allegato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nessuna attività da mostrare.
                        </TableCell>
                      </TableRow>
                    ) : (
                      audit.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(a.date)}
                          </TableCell>
                          <TableCell>{a.agent}</TableCell>
                          <TableCell>
                            {ACTION_LABELS[a.actionType] ?? a.actionType}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {a.playerId}
                            </code>
                          </TableCell>
                          <TableCell className="text-right">
                            {a.link ? (
                              <a
                                href={a.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                Apri
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminControl;

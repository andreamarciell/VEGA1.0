import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { api, apiResponse } from "@/lib/apiClient";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface TextTrigger {
  id: string;
  trigger_text: string;
  replacement_text: string;
  created_by: string | null;
  created_at: string;
}

export default function TextWizard() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [triggers, setTriggers] = useState<TextTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [triggerText, setTriggerText] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTriggers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/v1/text-triggers", getToken);
      const data = await apiResponse<{ triggers: TextTrigger[] }>(response);
      setTriggers(data.triggers ?? []);
    } catch (err) {
      toast({
        title: "Errore",
        description: err instanceof Error ? err.message : "Impossibile caricare i trigger",
        variant: "destructive",
      });
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  const openCreate = () => {
    setEditingId(null);
    setTriggerText("");
    setReplacementText("");
    setDialogOpen(true);
  };

  const openEdit = (t: TextTrigger) => {
    setEditingId(t.id);
    setTriggerText(t.trigger_text);
    setReplacementText(t.replacement_text);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trigger = triggerText.trim();
    const replacement = replacementText.trim();
    if (!trigger || !replacement) {
      toast({
        title: "Campi richiesti",
        description: "Inserisci testo trigger e testo sostituzione",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const response = await api.patch(
          `/api/v1/text-triggers/${editingId}`,
          { replacement_text: replacement },
          getToken
        );
        await apiResponse(response);
        toast({ title: "Trigger aggiornato" });
      } else {
        const response = await api.post(
          "/api/v1/text-triggers",
          { trigger_text: trigger, replacement_text: replacement },
          getToken
        );
        await apiResponse(response);
        toast({ title: "Trigger creato" });
      }
      setDialogOpen(false);
      fetchTriggers();
    } catch (err) {
      toast({
        title: "Errore",
        description: err instanceof Error ? err.message : "Operazione fallita",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await api.delete(`/api/v1/text-triggers/${id}`, getToken);
      await apiResponse(response);
      toast({ title: "Trigger eliminato" });
      fetchTriggers();
    } catch (err) {
      toast({
        title: "Errore",
        description: err instanceof Error ? err.message : "Eliminazione fallita",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              aria-label="Torna alla Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Text Wizard</h1>
              <p className="text-sm text-muted-foreground">
                Trigger → Sostituzione per espansione testo
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Trigger</CardTitle>
              <CardDescription>
                Quando il testo "Trigger" viene trovato, viene sostituito con "Sostituzione".
              </CardDescription>
            </div>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo trigger
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Sostituzione</TableHead>
                    <TableHead className="w-[120px]">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {triggers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Nessun trigger. Aggiungine uno con "Nuovo trigger".
                      </TableCell>
                    </TableRow>
                  ) : (
                    triggers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-sm">{t.trigger_text}</TableCell>
                        <TableCell className="font-mono text-sm">{t.replacement_text}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(t)}
                              aria-label="Modifica"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(t.id)}
                              disabled={deletingId === t.id}
                              className="text-destructive hover:text-destructive"
                              aria-label="Elimina"
                            >
                              {deletingId === t.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Modifica trigger" : "Nuovo trigger"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="trigger">Trigger (testo da cercare)</Label>
              <Input
                id="trigger"
                value={triggerText}
                onChange={(e) => setTriggerText(e.target.value)}
                placeholder="es. sigla"
                disabled={!!editingId}
              />
              {editingId && (
                <p className="text-xs text-muted-foreground">
                  Il trigger non può essere modificato; crea un nuovo trigger per cambiare il testo.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="replacement">Sostituzione</Label>
              <Input
                id="replacement"
                value={replacementText}
                onChange={(e) => setReplacementText(e.target.value)}
                placeholder="es. testo completo da inserire"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                "Salva"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

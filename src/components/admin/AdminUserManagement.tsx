import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PasswordInput } from "@/components/PasswordInput";
import { toast } from "@/hooks/use-toast";
import { Trash2, AlertTriangle, Shield } from "lucide-react";

// Queste funzioni (se non usano la service_role key) possono rimanere qui.
import { getAllUsers, createUser, supabase } from "@/lib/adminAuth"; // Importa anche supabase

interface User {
  user_id: string;
  username: string;
  created_at: string;
  updated_at: string;
  account_locked_until?: string;
  failed_login_attempts?: number;
}

// *** INSERISCI QUI IL TUO PROJECT REF DI SUPABASE ***
const SUPABASE_PROJECT_REF = "vobftcreopaqrfoonybp";
const DELETE_USER_FUNCTION_URL = `https://vobftcreopaqrfoonybp.supabase.co/functions/v1/delete-user`;


export const AdminUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState<{ email: string; username: string; password: string }>({ email: "", username: "", password: "" });

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      setError("Failed to fetch users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);
  
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare l'utente "${username}"? L'azione è irreversibile.`)) {
      return;
    }

    try {
      // Ottieni il token di accesso dell'utente admin attualmente loggato
      // Questo è FONDAMENTALE per la sicurezza della Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      // Chiama la Edge Function sicura, passando il token di autenticazione
      const response = await fetch(DELETE_USER_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error);
      }

      toast({ title: "Utente eliminato", description: `L'utente ${username} è stato rimosso.` });
      await fetchUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast({ title: "Eliminazione Fallita", description: error.message, variant: "destructive" });
    }
  };

  // Il resto del componente rimane uguale...
  const handleCreateUser = async () => { /* ... */ };
  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('it-IT');
  const isAccountLocked = (user: User) => user.account_locked_until && new Date(user.account_locked_until) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={() => setIsCreateOpen(true)}>Add User</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Registered Users ({users.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (<p>Loading...</p>) : error ? (<p className="text-destructive">{error}</p>) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Login Issues</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      {isAccountLocked(user) ? (
                        <Badge variant="destructive"><Shield className="w-3 h-3 mr-1" />Locked</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.failed_login_attempts && user.failed_login_attempts > 0 ? (
                        <div className="flex items-center gap-1 text-red-500">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{user.failed_login_attempts} failed</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.user_id, user.username)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Dialog per creare utenti... */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          {/* ... */}
        </DialogContent>
      </Dialog>
    </div>
  );
};

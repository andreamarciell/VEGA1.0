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
import { 
  Trash2, // Unica icona necessaria per le azioni
  AlertTriangle,
  Shield,
} from "lucide-react";

// NOTA: Queste funzioni dovrebbero idealmente essere spostate in API routes sicure.
import { getAllUsers, createUser } from "@/lib/adminAuth";

interface User {
  user_id: string;
  username: string;
  created_at: string;
  updated_at: string;
  login_attempts?: number;
  last_login_attempt?: string;
  account_locked_until?: string;
  failed_login_attempts?: number;
}

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

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.username || !newUser.password) {
      toast({ title: "Missing fields", description: "Please fill all fields" });
      return;
    }
    // NOTA: Anche questa operazione dovrebbe essere spostata in un'API route sicura.
    try {
      await createUser(newUser.email, newUser.username, newUser.password);
      toast({ title: "User created", description: "New user added successfully" });
      setIsCreateOpen(false);
      setNewUser({ email: "", username: "", password: "" });
      await fetchUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create user", variant: "destructive" });
    }
  };
  
  const handleDeleteUser = async (userId: string, username: string) => {
    // Chiedi sempre conferma per un'azione distruttiva!
    if (!window.confirm(`Sei sicuro di voler eliminare l'utente "${username}"? L'azione è irreversibile.`)) {
      return;
    }

    try {
      const response = await fetch('@/lib/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast({ title: "Utente eliminato", description: `L'utente ${username} è stato rimosso.` });
      await fetchUsers(); // Ricarica la lista per mostrare il cambiamento
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast({ title: "Eliminazione Fallita", description: error.message, variant: "destructive" });
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('it-IT');
  const isAccountLocked = (user: User) => user.account_locked_until && new Date(user.account_locked_until) > new Date();

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center">Caricamento utenti...</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={() => setIsCreateOpen(true)}>Add User</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-destructive">{error}</div>
          ) : (
            <div className="overflow-x-auto">
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
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.user_id, user.username)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finestra di dialogo per creare un nuovo utente */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input id="create-email" value={newUser.email} onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="create-username">Nickname</Label>
              <Input id="create-username" value={newUser.username} onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="create-password">Password</Label>
              <PasswordInput value={newUser.password} onChange={(value) => setNewUser(prev => ({ ...prev, password: value }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCreateUser}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

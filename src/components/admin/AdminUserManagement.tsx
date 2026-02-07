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
import { Trash2, AlertTriangle } from "lucide-react";

import { getAllUsers, createUser, checkAdminSession } from "@/lib/adminAuth"; 

interface User {
  user_id: string;
  username: string;
  created_at: string;
  updated_at: string;
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
      setError(null);
      const data = await getAllUsers();
      setUsers(data);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch users";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);
  
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action is irreversible.`)) {
      return;
    }

    try {
      // Check admin session with new cookie-based system
      const adminSession = await checkAdminSession();
      if (!adminSession) {
        toast({ 
          title: "Authentication Error", 
          description: "Admin session expired. Please login again.", 
          variant: "destructive" 
        });
        return;
      }

      const response = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Send cookies for authentication
      });

      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          toast({ 
            title: "Authentication Error", 
            description: "Admin session expired. Please login again.", 
            variant: "destructive" 
          });
          return;
        }
        throw new Error(result.error || 'An unknown error occurred');
      }

      toast({ title: "User Deleted", description: `User ${username} has been removed.` });
      await fetchUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
    }
  };

  // Funzionalità di creazione utente ripristinata
  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.username || !newUser.password) {
      toast({ title: "Missing fields", description: "Please fill all fields" });
      return;
    }
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

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString('it-IT');
  const isAccountLocked = (user: User) => user.account_locked_until && new Date(user.account_locked_until) > new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={() => setIsCreateOpen(true)} disabled={!!error}>Add User</Button>
      </div>
      
      
      <Card>
        <CardHeader><CardTitle>Registered Users ({users.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (<p className="text-center p-4">Loading...</p>) : error ? (<p className="text-center p-4 text-destructive">{error}</p>) : (
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

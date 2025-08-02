import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PasswordInput } from "@/components/PasswordInput";
import { 
  getAllUsers, 
  updateUserNickname, 
  updateUserPassword 
} from "@/lib/adminAuth";
import { toast } from "@/hooks/use-toast";
import { 
  Edit3, 
  Key, 
  Save, 
  AlertTriangle,
  Clock,
  Shield,
  X
} from "lucide-react";

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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editData, setEditData] = useState<{ username: string; password: string }>({ username: "", password: "" });
  const [isSaving, setIsSaving] = useState(false);

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

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      const promises = [];
      
      if (editData.username && editData.username !== editingUser.username) {
        promises.push(updateUserNickname(editingUser.user_id, editData.username));
      }
      
      if (editData.password) {
        promises.push(updateUserPassword(editingUser.user_id, editData.password));
      }

      await Promise.all(promises);
      
      toast({
        title: "Success",
        description: "User updated successfully",
      });
      
      setEditingUser(null);
      setEditData({ username: "", password: "" });
      await fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setEditData({
      username: user.username,
      password: ""
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isAccountLocked = (user: User) => {
    return user.account_locked_until && new Date(user.account_locked_until) > new Date();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading users...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2></div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Registered Users ({users.length})</span>
            <Badge variant="outline" className="text-xs">
              Real-time data
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={fetchUsers} className="mt-4">
                Retry
              </Button>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Login Issues</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell>
                        {isAccountLocked(user) ? (
                          <Badge variant="destructive" className="text-xs">
                            <Shield className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.login_attempts && user.login_attempts > 0 ? (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <span className="text-sm">{user.login_attempts} failed</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(user)}
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Edit
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

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editData.username}
                onChange={(e) => setEditData(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-password">New Password (leave empty to keep current)</Label>
              <PasswordInput
                value={editData.password}
                onChange={(value) => setEditData(prev => ({ ...prev, password: value }))}
                placeholder="Enter new password"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setEditingUser(null)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateUser}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
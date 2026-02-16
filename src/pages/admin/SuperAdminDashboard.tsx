import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useClerk, useUser, useOrganizationList } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { api, apiResponse } from "@/lib/apiClient";
import { 
  Shield, 
  LogOut, 
  Users, 
  Settings, 
  Activity,
  Building2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Key,
  Copy,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";

interface Tenant {
  id: string;
  clerk_org_id: string;
  db_name: string;
  display_name: string;
  created_at: string;
  bq_dataset_id?: string;
}

interface ActivityLog {
  id: string;
  tenant_id?: string;
  tenant_name?: string;
  activity_type: string;
  content: string;
  created_at: string;
  metadata?: any;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { isLoaded: isOrgLoaded, createOrganization } = useOrganizationList();
  const [activeTab, setActiveTab] = useState("tenants");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [showOnboardForm, setShowOnboardForm] = useState(false);
  const [onboardForm, setOnboardForm] = useState({ displayName: "", dbName: "" });
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [selectedTenantForApiKey, setSelectedTenantForApiKey] = useState<Tenant | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [deleteTenantDialogOpen, setDeleteTenantDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn || !userId) {
      navigate("/login", { replace: true });
      return;
    }

    fetchTenants();
  }, [isLoaded, isSignedIn, userId, navigate]);

  const fetchTenants = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/v1/super-admin/tenants', getToken);

      if (response.status === 401) {
        toast({
          title: "Unauthorized",
          description: "You don't have permission to access this page",
          variant: "destructive",
        });
        navigate("/login", { replace: true });
        return;
      }

      const data = await apiResponse(response);
      setTenants(data.tenants || []);
    } catch (error: any) {
      console.error('Error fetching tenants:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load tenants",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const response = await api.get('/api/v1/super-admin/activity', getToken);
      const data = await apiResponse(response);
      setActivityLogs(data.logs || []);
    } catch (error: any) {
      console.error('Error fetching activity logs:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load activity logs",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged Out",
        description: "You have been securely logged out",
      });
      navigate("/login", { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Logout Error",
        description: "An unexpected error occurred during logout",
        variant: "destructive",
      });
    }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.displayName || !onboardForm.dbName) {
      toast({
        title: "Missing fields",
        description: "Display Name and Database Name are required",
        variant: "destructive",
      });
      return;
    }

    if (!isOrgLoaded || !createOrganization) {
      toast({
        title: "Clerk not ready",
        description: "Please wait a moment and retry.",
        variant: "destructive",
      });
      return;
    }

    let createdOrganizationId: string | null = null;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Unable to get auth token');
      }

      // Create Clerk organization first
      const organization = await createOrganization({
        name: onboardForm.displayName,
      });

      if (!organization?.id) {
        throw new Error("Clerk organization creation failed.");
      }
      createdOrganizationId = organization.id;

      // Now onboard the tenant
      const response = await api.post(
        '/api/master/onboard',
        {
          clerk_org_id: organization.id,
          db_name: onboardForm.dbName,
          display_name: onboardForm.displayName,
        },
        getToken
      );

      await apiResponse(response);

      toast({
        title: "Tenant created",
        description: `Tenant onboarded successfully. Clerk Org ID: ${organization.id}`,
      });

      setOnboardForm({ displayName: "", dbName: "" });
      setShowOnboardForm(false);
      await fetchTenants();
    } catch (error: any) {
      const message =
        error instanceof Error ? error.message : "Unexpected onboarding error.";

      toast({
        title: "Onboarding failed",
        description: message,
        variant: "destructive",
      });

      if (createdOrganizationId) {
        window.alert(
          `Clerk organization ${createdOrganizationId} was created but backend onboarding failed. Delete it manually in Clerk dashboard if needed.`
        );
      }
    }
  };

  useEffect(() => {
    if (activeTab === "activity") {
      fetchActivityLogs();
    }
  }, [activeTab]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Super Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Multi-tenant Control Center
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="text-xs">
                <Activity className="w-3 h-3 mr-1" />
                {user?.emailAddresses[0]?.emailAddress || "Admin"}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="tenants" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="risk-engine" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Risk Engine
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tenants">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tenants</CardTitle>
                    <CardDescription>
                      Manage all tenant organizations and their databases
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button onClick={fetchTenants} variant="outline" size="sm">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Button onClick={() => setShowOnboardForm(!showOnboardForm)} size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      New Tenant
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {showOnboardForm && (
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle>Onboard New Tenant</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleOnboard} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Display Name</label>
                            <input
                              type="text"
                              className="w-full p-2 border rounded-md"
                              value={onboardForm.displayName}
                              onChange={(e) => setOnboardForm({ ...onboardForm, displayName: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Database Name</label>
                            <input
                              type="text"
                              className="w-full p-2 border rounded-md"
                              value={onboardForm.dbName}
                              onChange={(e) => setOnboardForm({ ...onboardForm, dbName: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setShowOnboardForm(false)}>
                            Cancel
                          </Button>
                          <Button type="submit">Create Tenant</Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    <span>Loading tenants...</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Clerk Org ID</TableHead>
                        <TableHead>Database Name</TableHead>
                        <TableHead>BigQuery Dataset</TableHead>
                        <TableHead>API Key</TableHead>
                        <TableHead>Created At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No tenants found
                          </TableCell>
                        </TableRow>
                      ) : (
                        tenants.map((tenant) => (
                          <TableRow key={tenant.id}>
                            <TableCell className="font-medium">{tenant.display_name}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {tenant.clerk_org_id}
                              </code>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {tenant.db_name}
                              </code>
                            </TableCell>
                            <TableCell>
                              {tenant.bq_dataset_id ? (
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {tenant.bq_dataset_id}
                                </code>
                              ) : (
                                <Badge variant="outline">Not set</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                ••••••••••••
                              </code>
                            </TableCell>
                            <TableCell>
                              {new Date(tenant.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenApiKeyDialog(tenant)}
                                >
                                  <Key className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setTenantToDelete(tenant);
                                    setDeleteTenantDialogOpen(true);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
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
          </TabsContent>

          <TabsContent value="risk-engine">
            <Card>
              <CardHeader>
                <CardTitle>Risk Engine Configuration</CardTitle>
                <CardDescription>
                  Configure risk settings for a specific tenant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.display_name} ({tenant.db_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTenant && (
                    <Button onClick={() => navigate(`/super-admin/risk-config/${selectedTenant}`)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Configure Risk Engine
                    </Button>
                  )}
                </div>
                {!selectedTenant && (
                  <p className="text-sm text-muted-foreground">
                    Please select a tenant to configure its risk engine settings
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  Manage users for tenant organizations via Clerk
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-4">
                  <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                    <SelectTrigger className="w-[300px]">
                      <SelectValue placeholder="Select a tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.display_name} ({tenant.db_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTenant && (
                    <Button onClick={() => navigate(`/super-admin/users/${selectedTenant}`)}>
                      <Users className="w-4 h-4 mr-2" />
                      Manage Users
                    </Button>
                  )}
                </div>
                {!selectedTenant && (
                  <p className="text-sm text-muted-foreground">
                    Please select a tenant to manage its users
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Activity Log</CardTitle>
                    <CardDescription>
                      View tenant creation logs and ingestion activity
                    </CardDescription>
                  </div>
                  <Button onClick={fetchActivityLogs} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Content</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          No activity logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      activityLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant="outline">{log.activity_type}</Badge>
                          </TableCell>
                          <TableCell>{log.tenant_name || "N/A"}</TableCell>
                          <TableCell className="max-w-md truncate">
                            {typeof log.content === 'string' 
                              ? log.content 
                              : JSON.stringify(log.content)}
                          </TableCell>
                          <TableCell>
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* API Key Management Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage API Key</DialogTitle>
            <DialogDescription>
              API key for {selectedTenantForApiKey?.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isLoadingApiKey ? (
              <div className="flex items-center justify-center p-4">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={apiKey || ""}
                      readOnly
                      className="font-mono text-sm"
                      placeholder={apiKey ? "" : "No API key - Click Regenerate to create one"}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyApiKey}
                      disabled={!apiKey}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleRegenerateApiKey}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4 mr-2" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tenant Dialog */}
      <Dialog open={deleteTenantDialogOpen} onOpenChange={setDeleteTenantDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {tenantToDelete?.display_name}? This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Drop the PostgreSQL database ({tenantToDelete?.db_name})</li>
                <li>Delete the BigQuery dataset ({tenantToDelete?.bq_dataset_id || 'N/A'})</li>
                <li>Remove all API keys</li>
                <li>Delete the tenant record</li>
              </ul>
              <strong className="text-red-600">This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTenantDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTenant}
              disabled={isDeletingTenant}
            >
              {isDeletingTenant ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Tenant
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

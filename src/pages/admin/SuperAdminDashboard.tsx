import { FormEvent, useMemo, useState } from "react";
import { useAuth, useOrganizationList } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const SuperAdminDashboard = () => {
  const [displayName, setDisplayName] = useState("");
  const [dbName, setDbName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { getToken } = useAuth();
  const { isLoaded: isOrgLoaded, createOrganization } = useOrganizationList();

  const isFormValid = useMemo(() => {
    return displayName.trim().length > 0 && dbName.trim().length > 0;
  }, [displayName, dbName]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanDisplayName = displayName.trim();
    const cleanDbName = dbName.trim();

    if (!cleanDisplayName || !cleanDbName) {
      toast({
        title: "Missing fields",
        description: "Display Name and Database Name are required.",
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

    setIsSubmitting(true);
    let createdOrganizationId: string | null = null;

    try {
      const organization = await createOrganization({
        name: cleanDisplayName,
      });

      if (!organization?.id) {
        throw new Error("Clerk organization creation failed.");
      }
      createdOrganizationId = organization.id;

      const token = await getToken();
      if (!token) {
        throw new Error("Unable to get auth token from Clerk.");
      }

      const response = await fetch("/api/master/onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clerk_org_id: organization.id,
          db_name: cleanDbName,
          display_name: cleanDisplayName,
        }),
      });

      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          responseBody?.message ||
            responseBody?.error ||
            "Backend onboarding request failed."
        );
      }

      toast({
        title: "Tenant created",
        description: `Tenant onboarded successfully. Clerk Org ID: ${organization.id}`,
      });

      setDisplayName("");
      setDbName("");
    } catch (error) {
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Super Admin - Tenant Onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Nome Azienda</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={isSubmitting}
                  autoComplete="organization"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="db-name">Nome Database</Label>
                <Input
                  id="db-name"
                  value={dbName}
                  onChange={(event) => setDbName(event.target.value)}
                  disabled={isSubmitting}
                  autoComplete="off"
                />
              </div>

              <Button type="submit" disabled={!isFormValid || isSubmitting}>
                {isSubmitting ? "Creazione in corso..." : "Crea Tenant"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth, useOrganization, SignIn } from "@clerk/clerk-react";

const EXTENSION_LOGIN_PATH = "/auth/extension-login";

// Requires VITE_VEGA_EXTENSION_ID in .env for extension return_url (chromiumapp.org)
const VEGA_EXTENSION_ID = import.meta.env.VITE_VEGA_EXTENSION_ID ?? "";

/**
 * Validates return_url to prevent open redirect:
 * - must be https
 * - and either contain "vega" (web app) or host is the Vega extension (chromiumapp.org)
 */
function isAllowedReturnUrl(url: string): boolean {
  try {
    if (!url.startsWith("https://")) return false;
    const lower = url.toLowerCase();
    if (lower.includes("vega")) return true;
    const parsed = new URL(url);
    return parsed.hostname === `${VEGA_EXTENSION_ID}.chromiumapp.org`;
  } catch {
    return false;
  }
}

export default function ExtensionLogin() {
  const [searchParams] = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();

  const returnUrl = searchParams.get("return_url") ?? "";

  const allowedReturnUrl = useMemo(() => {
    return returnUrl && isAllowedReturnUrl(returnUrl) ? returnUrl : null;
  }, [returnUrl]);

  useEffect(() => {
    if (!isLoaded || !isOrgLoaded || !allowedReturnUrl) return;
    if (!isSignedIn) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getToken();
        const orgId = organization?.id ?? "";
        if (cancelled || !token) return;
        const finalUrl = `${allowedReturnUrl}#token=${encodeURIComponent(token)}&orgId=${encodeURIComponent(orgId)}`;
        window.location.href = finalUrl;
      } catch (err) {
        console.error("Extension login redirect error:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isOrgLoaded, isSignedIn, getToken, organization?.id, allowedReturnUrl]);

  if (!allowedReturnUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="text-center max-w-md">
          <h1 className="text-lg font-semibold text-destructive">URL non consentito</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Il link di ritorno deve essere HTTPS e contenere &quot;vega&quot; oppure essere l&apos;URL dell&apos;estensione Chrome (chromiumapp.org).
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded || !isOrgLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Reindirizzamento all&apos;estensione...</p>
        </div>
      </div>
    );
  }

  const afterSignInUrl = `${window.location.origin}${EXTENSION_LOGIN_PATH}?return_url=${encodeURIComponent(returnUrl)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">Login estensione Vega</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accedi per usare l&apos;estensione
          </p>
        </div>
        <SignIn
          routing="virtual"
          fallbackRedirectUrl={afterSignInUrl}
          forceRedirectUrl={afterSignInUrl}
        />
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth, useClerk, useSession } from "@clerk/clerk-react";

const SESSION_MAX_MINUTES = 180; // 3 ore
const CHECK_INTERVAL_MS = 60 * 1000; // ogni minuto

/** Route su cui NON applicare il timeout: login e login estensione (estensione può restare loggata finché non si slogga). */
const NO_TIMEOUT_PATHS = ["/auth/login", "/auth/extension-login"];

function isPlatformRoute(pathname: string): boolean {
  if (NO_TIMEOUT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return false;
  // Timeout solo su route "piattaforma" (dashboard, vega, review, text-wizard, control, extensions, ecc.)
  const platformPrefixes = ["/dashboard", "/vega", "/review", "/text-wizard", "/control", "/extensions", "/work-in-progress", "/presentation"];
  return platformPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Applica l'auto-logout dopo 3 ore solo quando l'utente usa la piattaforma web.
 * Non interferisce con l'estensione Chrome: chi fa login tramite estensione può usarla
 * finché non si slogga; il timeout scatta solo se ha un tab aperto sulla piattaforma.
 */
export const SessionTimeout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { session, isLoaded } = useSession();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !session || hasRedirected.current) {
      return;
    }
    if (!isPlatformRoute(location.pathname)) {
      return;
    }

    const checkSessionAge = () => {
      if (hasRedirected.current) return;
      const createdAt = session.createdAt;
      if (!createdAt) return;

      const createdAtMs = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
      const elapsedMs = Date.now() - createdAtMs;
      const maxMs = SESSION_MAX_MINUTES * 60 * 1000;

      if (elapsedMs >= maxMs) {
        hasRedirected.current = true;
        signOut().then(() => {
          navigate("/auth/login", {
            replace: true,
            state: { sessionExpired: true, message: "Sessione scaduta per sicurezza." },
          });
        });
      }
    };

    checkSessionAge();
    const intervalId = setInterval(checkSessionAge, CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isLoaded, isSignedIn, session, signOut, navigate, location.pathname]);

  return null;
};

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "./use-auth-store";
import { api } from "@/lib/api-client";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setAuth, clearAuth, setLoading } = useAuthStore();
  const syncingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function syncBackendProfile(session: any) {
      if (!session || syncingRef.current) return;
      syncingRef.current = true;

      try {
        const data = await api.getMe();
        if (isMounted) {
          setAuth({
            user: session.user,
            session,
            profile: data.profile,
            activeWorkspace: data.activeWorkspace,
            workspaces: data.workspaces,
          });
        }
      } catch (err) {
        console.warn("[MailPilot] Could not sync user profile with backend:", err);
        if (isMounted) {
          // Still preserve Supabase session so user is authenticated in the client
          setAuth({
            user: session.user,
            session,
          });
        }
      } finally {
        syncingRef.current = false;
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;

      if (session) {
        syncBackendProfile(session);
      } else {
        clearAuth();
      }
    });

    // 2. Real-time Auth State Change Listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session) {
        clearAuth();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        syncBackendProfile(session);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setAuth, clearAuth, setLoading]);

  return <>{children}</>;
}


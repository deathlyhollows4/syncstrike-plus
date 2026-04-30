import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "team_member";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: Role | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingClearedRef = useRef(false);

  const clearLoading = () => {
    if (!loadingClearedRef.current) {
      loadingClearedRef.current = true;
      setLoading(false);
    }
  };

  const fetchRole = async (uid: string) => {
    try {
      // Best-effort block check. If it fails, we still try to resolve the role
      // so the UI doesn't hang on a transient profile read error.
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("is_blocked")
        .eq("id", uid)
        .maybeSingle();
      if (!profErr && prof?.is_blocked) {
        await supabase.auth.signOut();
        setRole(null);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .order("role", { ascending: true }); // admin sorts before team_member
      if (error) {
        console.warn("[auth] role fetch failed", error);
        setRole(null);
        return;
      }
      if (data && data.length > 0) {
        setRole(data.some((r) => r.role === "admin") ? "admin" : "team_member");
      } else {
        setRole(null);
      }
    } catch (err) {
      console.warn("[auth] role fetch threw", err);
      setRole(null);
    } finally {
      clearLoading();
    }
  };

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock inside callback
        const uid = s.user.id;
        setTimeout(() => fetchRole(uid), 0);
      } else {
        setRole(null);
        clearLoading();
      }
      // Safety: regardless of role outcome, never leave loading=true forever.
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "SIGNED_OUT") {
        // fetchRole clears loading on success/failure; this guards the no-user case.
        if (!s?.user) clearLoading();
      }
    });

    // Then existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchRole(data.session.user.id);
      } else {
        clearLoading();
      }
    }).catch(() => clearLoading());

    // Hard fallback: never let loading hang past 5s.
    const t = setTimeout(clearLoading, 5000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, isAdmin: role === "admin", signOut, refreshRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

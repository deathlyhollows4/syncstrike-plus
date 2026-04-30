import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  const fetchRole = async (uid: string) => {
    // First: enforce block status. If blocked, terminate the session immediately.
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_blocked")
      .eq("id", uid)
      .maybeSingle();
    if (prof?.is_blocked) {
      await supabase.auth.signOut();
      setRole(null);
      return;
    }

    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .order("role", { ascending: true }); // admin sorts before team_member
    if (data && data.length > 0) {
      setRole(data.some((r) => r.role === "admin") ? "admin" : "team_member");
    } else {
      setRole(null);
    }
  };

  useEffect(() => {
    // Listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer to avoid deadlock inside callback
        setTimeout(() => fetchRole(s.user.id), 0);
      } else {
        setRole(null);
      }
    });

    // Then existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchRole(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
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

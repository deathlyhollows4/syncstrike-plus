import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, ShieldOff, ShieldCheck, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/admin")({ component: AdminPage });

interface Row {
  id: string; email: string; display_name: string | null;
  is_blocked: boolean; created_at: string; role: "admin" | "team_member" | null;
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [stats, setStats] = useState({ users: 0, tasks: 0, blocked: 0 });

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/dashboard" });
  }, [loading, isAdmin, navigate]);

  const load = async () => {
    const [{ data: profiles }, { data: roles }, { count: tcount }, { count: bcount }] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, is_blocked, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("tasks").select("*", { count: "exact", head: true }),
      supabase.from("tasks").select("*", { count: "exact", head: true }).eq("status", "blocked"),
    ]);
    const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
    const merged: Row[] = (profiles ?? []).map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? null }));
    setRows(merged);
    setStats({ users: merged.length, tasks: tcount ?? 0, blocked: bcount ?? 0 });
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const toggleBlock = async (r: Row) => {
    const { error } = await supabase.from("profiles").update({ is_blocked: !r.is_blocked }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(r.is_blocked ? "User unblocked" : "User blocked");
    load();
  };

  const deleteUser = async (r: Row) => {
    if (!confirm(`Delete ${r.email}? This removes their profile and all their data.`)) return;
    // Cascading FKs on profiles.id -> auth.users delete the auth row too via admin API,
    // but with anon key we can only delete the profile row. We delete tasks/roles/profile.
    const { error } = await supabase.from("profiles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Profile + data removed (auth row remains, can be removed in Cloud dashboard)");
    load();
  };

  if (!isAdmin) return null;

  const filtered = (rows ?? []).filter((r) =>
    q === "" || r.email.toLowerCase().includes(q.toLowerCase()) ||
    (r.display_name ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-gold-shine">Admin</p>
        <h1 className="font-display text-3xl font-bold mt-1">Admin dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total users", val: stats.users },
          { label: "Total tasks", val: stats.tasks },
          { label: "Blocked tasks", val: stats.blocked, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="p-5 surface border-border/60">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={`mt-2 font-display text-4xl font-bold ${s.color ?? ""}`}>{s.val}</p>
          </Card>
        ))}
      </div>

      <Card className="surface border-border/60 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border/60">
          <h2 className="font-display text-lg font-semibold">Users</h2>
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-9" />
          </div>
        </div>

        {!rows ? (
          <div className="p-6 space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6" /> No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Role</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Joined</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-accent/20">
                    <td className="p-3">
                      <p className="font-medium">{r.display_name ?? r.email.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground">{r.email}</p>
                    </td>
                    <td className="p-3">
                      <Badge className={r.role === "admin"
                        ? "bg-gold-shine text-[oklch(0.16_0.02_75)] border-0"
                        : "bg-muted text-muted-foreground"}>
                        {r.role ?? "—"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {r.is_blocked
                        ? <Badge variant="destructive">Blocked</Badge>
                        : <Badge className="bg-success/20 text-success border border-success/40">Active</Badge>}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleBlock(r)}>
                          {r.is_blocked
                            ? <><ShieldCheck className="h-4 w-4 mr-1" /> Unblock</>
                            : <><ShieldOff className="h-4 w-4 mr-1" /> Block</>}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteUser(r)}
                          className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

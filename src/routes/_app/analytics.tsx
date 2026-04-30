import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { format, subDays, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/analytics")({ component: AnalyticsPage });

interface Row { status: string; completed_at: string | null; created_at: string; team_id: string | null; }
interface TeamOpt { id: string; name: string; }

function AnalyticsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [teamFilter, setTeamFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data }, { data: t }] = await Promise.all([
        supabase.from("tasks").select("status, completed_at, created_at, team_id"),
        supabase.from("teams").select("id, name").order("name"),
      ]);
      setRows((data as Row[]) ?? []);
      setTeams((t as TeamOpt[]) ?? []);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (teamFilter === "all") return rows;
    if (teamFilter === "personal") return rows.filter((r) => r.team_id === null);
    return rows.filter((r) => r.team_id === teamFilter);
  }, [rows, teamFilter]);

  const stats = useMemo(() => ({
    total: filtered.length,
    completed: filtered.filter((t) => t.status === "completed").length,
    blocked: filtered.filter((t) => t.status === "blocked").length,
    inProgress: filtered.filter((t) => t.status === "in_progress").length,
  }), [filtered]);

  const trend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(new Date(), 6 - i)));
    return days.map((d) => ({
      day: format(d, "EEE"),
      count: filtered.filter((t) => t.completed_at && startOfDay(new Date(t.completed_at)).getTime() === d.getTime()).length,
    }));
  }, [filtered]);

  const max = Math.max(...trend.map((t) => t.count), 1);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Insights</p>
          <h1 className="font-display text-3xl font-bold mt-1">Analytics</h1>
        </div>
        <div className="w-48">
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              <SelectItem value="personal">Personal only</SelectItem>
              {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total tasks", val: stats.total, color: "" },
          { label: "Completed", val: stats.completed, color: "text-success" },
          { label: "In progress", val: stats.inProgress, color: "text-gold-shine" },
          { label: "Blocked", val: stats.blocked, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label} className="p-5 surface border-border/60">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={`mt-2 font-display text-4xl font-bold ${s.color}`}>{s.val}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6 surface border-border/60">
        <h2 className="font-display text-lg font-semibold">7-day completion trend</h2>
        <div className="mt-6 flex items-end gap-3 h-48">
          {trend.map((t) => (
            <div key={t.day} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-gold-shine rounded-t-md transition-all"
                style={{ height: `${(t.count / max) * 100}%`, minHeight: t.count > 0 ? "8px" : "2px" }} />
              <p className="text-[11px] text-muted-foreground">{t.day}</p>
              <p className="text-xs font-bold">{t.count}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

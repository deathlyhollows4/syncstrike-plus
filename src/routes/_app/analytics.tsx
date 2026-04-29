import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { format, subDays, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_app/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, completed: 0, blocked: 0, inProgress: 0 });
  const [trend, setTrend] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("tasks").select("status, completed_at, created_at");
      if (!data) return;
      const total = data.length;
      const completed = data.filter((t: any) => t.status === "completed").length;
      const blocked = data.filter((t: any) => t.status === "blocked").length;
      const inProgress = data.filter((t: any) => t.status === "in_progress").length;
      setStats({ total, completed, blocked, inProgress });

      const days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(new Date(), 6 - i)));
      setTrend(days.map((d) => ({
        day: format(d, "EEE"),
        count: data.filter((t: any) => t.completed_at && startOfDay(new Date(t.completed_at)).getTime() === d.getTime()).length,
      })));
    })();
  }, [user]);

  const max = Math.max(...trend.map((t) => t.count), 1);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Insights</p>
        <h1 className="font-display text-3xl font-bold mt-1">Analytics</h1>
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  addDays,
  addMonths,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { TaskCreateModal } from "@/components/TaskCreateModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import type { Task } from "@/types/task";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type View = "day" | "week" | "month";

function Dashboard() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const loadTasks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:profiles!assignee_id(display_name, email)
      `)
      .order("scheduled_for", { ascending: true });
    setTasks((data as any) ?? []);
  };

  useEffect(() => {
    loadTasks();
  }, [user]);

  // realtime updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => loadTasks())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const days = useMemo(() => {
    if (view === "day") return [cursor];
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfMonth(cursor);
    const cells: Date[] = [];
    let d = start;
    while (d <= end || cells.length % 7 !== 0) {
      cells.push(d);
      d = addDays(d, 1);
    }
    return cells;
  }, [view, cursor]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      const key = t.scheduled_for
        ? format(new Date(t.scheduled_for), "yyyy-MM-dd")
        : t.deadline
          ? format(new Date(t.deadline), "yyyy-MM-dd")
          : null;
      if (!key) return;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    });
    return m;
  }, [tasks]);

  const move = (dir: 1 | -1) => {
    if (view === "day") setCursor((c) => addDays(c, dir));
    else if (view === "week") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => addMonths(c, dir));
  };

  const headerLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `Week of ${format(startOfWeek(cursor, { weekStartsOn: 1 }), "MMM d, yyyy")}`
        : format(cursor, "EEEE, MMMM d, yyyy");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Chrono-Dashboard</p>
          <h1 className="font-display text-3xl font-bold mt-1">{headerLabel}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/60 bg-card p-1">
            {(["day", "week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  view === v
                    ? "bg-gold-shine text-[oklch(0.16_0.02_75)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border/60 bg-card">
            <button
              onClick={() => move(-1)}
              className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setCursor(new Date())} className="px-3 py-1.5 text-xs">
              Today
            </button>
            <button
              onClick={() => move(1)}
              className="px-2 py-1.5 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button
            onClick={() => {
              setCreateDate(new Date());
              setCreateOpen(true);
            }}
            className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold"
          >
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <div className="rounded-xl border border-border/60 surface overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border/60 bg-card/50">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(d, cursor);
              const today = isSameDay(d, new Date());
              return (
                <button
                  key={key}
                  onClick={() => {
                    setCreateDate(startOfDay(d));
                    setCreateOpen(true);
                  }}
                  className={`relative min-h-[110px] border-b border-r border-border/40 p-2 text-left transition hover:bg-accent/30 ${
                    !inMonth ? "opacity-40" : ""
                  }`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      today
                        ? "bg-gold-shine text-[oklch(0.16_0.02_75)] font-bold"
                        : "text-muted-foreground"
                    }`}
                  >
                    {format(d, "d")}
                  </span>
                  <div className="mt-1.5 space-y-1">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTask(t);
                        }}
                        className={`truncate rounded px-1.5 py-0.5 text-[11px] cursor-pointer ${statusBg(t.status)} flex items-center gap-1`}
                      >
                        <span className="flex-1 truncate">{t.title}</span>
                        {t.assignee_id && t.assignee_id !== user?.id && t.assignee && (
                          <span className="bg-gold-shine/20 text-gold-shine text-[9px] px-1 rounded font-bold">
                            {(t.assignee.display_name ?? t.assignee.email.split("@")[0]).charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className={`grid gap-4 ${view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1"}`}
        >
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className="rounded-xl border border-border/60 surface p-4 min-h-[200px]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {format(d, "EEE")}
                    </p>
                    <p className="font-display text-2xl font-bold">{format(d, "d")}</p>
                  </div>
                  <button
                    onClick={() => {
                      setCreateDate(startOfDay(d));
                      setCreateOpen(true);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 space-y-1.5">
                  {dayTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground/60">No tasks</p>
                  )}
                  {dayTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTask(t)}
                      className={`block w-full rounded-md border border-border/40 px-2 py-1.5 text-left text-xs hover:border-primary/40 transition`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${statusDot(t.status)}`}
                      />
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={createDate}
        onCreated={loadTasks}
      />
      <TaskDetailModal
        task={activeTask}
        onOpenChange={(o) => !o && setActiveTask(null)}
        onChanged={loadTasks}
      />
    </div>
  );
}

function statusBg(s: string) {
  return s === "completed"
    ? "bg-success/20 text-success-foreground"
    : s === "in_progress"
      ? "bg-primary/20 text-primary"
      : s === "blocked"
        ? "bg-destructive/20 text-destructive"
        : "bg-muted text-muted-foreground";
}
function statusDot(s: string) {
  return s === "completed"
    ? "bg-success"
    : s === "in_progress"
      ? "bg-gold-shine"
      : s === "blocked"
        ? "bg-destructive"
        : "bg-muted-foreground";
}

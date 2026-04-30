import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskCreateModal } from "@/components/TaskCreateModal";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import type { Task } from "@/types/task";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed" | "blocked">(
    "all",
  );
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [active, setActive] = useState<Task | null>(null);

  const load = async () => {
    const [{ data }, { data: t }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("teams").select("id, name"),
    ]);
    setTasks((data as any) ?? []);
    const map: Record<string, string> = {};
    (t ?? []).forEach((x: any) => {
      map[x.id] = x.name;
    });
    setTeams(map);
  };
  useEffect(() => {
    load();
  }, [user]);
  useEffect(() => {
    const ch = supabase
      .channel("tasks-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = tasks.filter(
    (t) =>
      (filter === "all" || t.status === filter) &&
      (q === "" || t.title.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">All tasks</p>
          <h1 className="font-display text-3xl font-bold mt-1">Tasks</h1>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold"
        >
          <Plus className="mr-1 h-4 w-4" /> New task
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="pl-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In progress</TabsTrigger>
            <TabsTrigger value="blocked">Blocked</TabsTrigger>
            <TabsTrigger value="completed">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-xl border border-border/60 surface overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No tasks here yet.</div>
        ) : (
          <ul className="divide-y divide-border/40">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActive(t)}
                  className="w-full text-left p-4 hover:bg-accent/30 transition flex items-center gap-4"
                >
                  <div className={`h-2 w-2 rounded-full shrink-0 ${dotColor(t.status)}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    {t.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {t.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="capitalize text-[10px] hidden sm:inline-flex">
                    {t.priority}
                  </Badge>
                  {t.team_id && teams[t.team_id] && (
                    <Badge
                      variant="outline"
                      className="text-[10px] hidden md:inline-flex border-gold-shine/30 text-gold-shine"
                    >
                      {teams[t.team_id]}
                    </Badge>
                  )}
                  {t.deadline && (
                    <span className="text-xs text-muted-foreground hidden md:inline">
                      {format(new Date(t.deadline), "MMM d")}
                    </span>
                  )}
                  <Badge className={`shrink-0 ${badge(t.status)}`}>
                    {t.status.replace("_", " ")}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TaskCreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      <TaskDetailModal task={active} onOpenChange={(o) => !o && setActive(null)} onChanged={load} />
    </div>
  );
}

const dotColor = (s: string) =>
  s === "completed"
    ? "bg-success"
    : s === "in_progress"
      ? "bg-gold-shine"
      : s === "blocked"
        ? "bg-destructive"
        : "bg-muted-foreground";
const badge = (s: string) =>
  s === "completed"
    ? "bg-success/20 text-success border border-success/40"
    : s === "in_progress"
      ? "bg-primary/20 text-primary border border-primary/40"
      : s === "blocked"
        ? "bg-destructive/20 text-destructive border border-destructive/40"
        : "bg-muted text-muted-foreground";

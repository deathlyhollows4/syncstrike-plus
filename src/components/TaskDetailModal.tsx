import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import type { Task } from "@/types/task";

interface Props {
  task: Task | null;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}

export function TaskDetailModal({ task, onOpenChange, onChanged }: Props) {
  const { user, isAdmin } = useAuth();
  const [progress, setProgress] = useState(0);
  const [completionDesc, setCompletionDesc] = useState("");
  const [blockerReason, setBlockerReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (task) {
      setProgress(task.progress);
      setCompletionDesc(task.completion_description ?? "");
      setBlockerReason(task.blocker_reason ?? "");
    }
  }, [task]);

  if (!task) return null;
  const canEdit = isAdmin || task.creator_id === user?.id || task.assignee_id === user?.id;

  const update = async (patch: Partial<Task>) => {
    setBusy(true);
    const { error } = await supabase
      .from("tasks")
      .update(patch as any)
      .eq("id", task.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return false;
    }
    onChanged?.();
    return true;
  };

  const startTask = async () => {
    if (await update({ status: "in_progress", progress: Math.max(progress, 10) }))
      toast.success("Task started");
  };
  const completeTask = async () => {
    if (completionDesc.trim().length < 5)
      return toast.error("Completion note must be at least 5 characters");
    if (
      await update({ status: "completed", progress: 100, completion_description: completionDesc })
    ) {
      toast.success("Task completed");
      onOpenChange(false);
    }
  };
  const blockTask = async () => {
    if (blockerReason.trim().length < 3) return toast.error("Blocker reason required");
    if (await update({ status: "blocked", blocker_reason: blockerReason })) {
      toast.warning("Task blocked — admins notified");
      onOpenChange(false);
    }
  };
  const saveProgress = async () => {
    if (await update({ progress })) toast.success("Progress saved");
  };

  const del = async () => {
    if (!confirm("Delete this task?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onOpenChange(false);
    onChanged?.();
  };

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="font-display text-xl pr-4">{task.title}</DialogTitle>
            <Badge className={`shrink-0 ${badgeColor(task.status)}`}>
              {task.status.replace("_", " ")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Priority</p>
              <p className="mt-0.5 font-semibold capitalize">{task.priority}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Deadline</p>
              <p className="mt-0.5 font-semibold">
                {task.deadline ? format(new Date(task.deadline), "MMM d, p") : "—"}
              </p>
            </div>
          </div>

          {canEdit && task.status !== "completed" && (
            <>
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <Slider
                  value={[progress]}
                  onValueChange={(v) => setProgress(v[0])}
                  max={100}
                  step={5}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveProgress}
                  disabled={busy}
                  className="mt-2"
                >
                  Save progress
                </Button>
              </div>

              {task.status === "pending" && (
                <Button onClick={startTask} disabled={busy} className="w-full">
                  Start task
                </Button>
              )}

              <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-success">Complete this task</p>
                <Textarea
                  placeholder="What did you accomplish? (min 5 chars)"
                  value={completionDesc}
                  onChange={(e) => setCompletionDesc(e.target.value)}
                  rows={2}
                />
                <Button
                  onClick={completeTask}
                  disabled={busy}
                  className="w-full bg-success text-success-foreground hover:opacity-90"
                >
                  Mark completed
                </Button>
              </div>

              {task.status !== "blocked" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <p className="text-xs font-semibold text-destructive">Block this task</p>
                  <Textarea
                    placeholder="What's blocking you? (min 3 chars)"
                    value={blockerReason}
                    onChange={(e) => setBlockerReason(e.target.value)}
                    rows={2}
                  />
                  <Button
                    onClick={blockTask}
                    disabled={busy}
                    variant="destructive"
                    className="w-full"
                  >
                    Mark blocked
                  </Button>
                </div>
              )}
            </>
          )}

          {task.status === "blocked" && task.blocker_reason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
              <p className="text-xs font-semibold text-destructive uppercase tracking-wider">
                Blocker
              </p>
              <p className="mt-1">{task.blocker_reason}</p>
            </div>
          )}
          {task.status === "completed" && task.completion_description && (
            <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
              <p className="text-xs font-semibold text-success uppercase tracking-wider">
                Completed
              </p>
              <p className="mt-1">{task.completion_description}</p>
            </div>
          )}
        </div>

        <DialogFooter className="justify-between sm:justify-between">
          {canEdit && (
            <Button
              variant="ghost"
              onClick={del}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function badgeColor(s: string) {
  return s === "completed"
    ? "bg-success/20 text-success border-success/40"
    : s === "in_progress"
      ? "bg-primary/20 text-primary border-primary/40"
      : s === "blocked"
        ? "bg-destructive/20 text-destructive border-destructive/40"
        : "bg-muted text-muted-foreground";
}

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate?: Date | null;
  onCreated?: () => void;
}

interface TeamOpt {
  id: string;
  name: string;
}
interface MemberOpt {
  user_id: string;
  display_name: string | null;
  email: string;
}

export function TaskCreateModal({ open, onOpenChange, defaultDate, onCreated }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [scheduled, setScheduled] = useState("");
  const [deadline, setDeadline] = useState("");
  const [teamId, setTeamId] = useState<string>("personal");
  const [assigneeId, setAssigneeId] = useState<string>("self");
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setScheduled(defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : "");
      setDeadline("");
      setTeamId("personal");
      setAssigneeId("self");
    }
  }, [open, defaultDate]);

  // Load teams when opening
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from("teams").select("id, name").order("name");
      setTeams((data as TeamOpt[]) ?? []);
    })();
  }, [open]);

  // Load members of selected team
  useEffect(() => {
    if (teamId === "personal") {
      setMembers([]);
      setAssigneeId("self");
      return;
    }
    (async () => {
      const { data: tm } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId);
      const ids = (tm ?? []).map((x: any) => x.user_id);
      if (!ids.length) {
        setMembers([]);
        return;
      }
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", ids);
      setMembers(
        (ps ?? []).map((p: any) => ({
          user_id: p.id,
          email: p.email,
          display_name: p.display_name,
        })),
      );
    })();
  }, [teamId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("tasks").insert({
      title,
      description: description || null,
      priority,
      scheduled_for: scheduled ? new Date(scheduled).toISOString() : null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      creator_id: user.id,
      assignee_id: assigneeId === "self" ? user.id : assigneeId,
      team_id: teamId === "personal" ? null : teamId,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task created");
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal (no team)</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {teamId !== "personal" && (
            <div>
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Me</SelectItem>
                  {members
                    .filter((m) => m.user_id !== user?.id)
                    .map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.display_name ?? m.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-sch">Scheduled for</Label>
              <Input
                id="t-sch"
                type="datetime-local"
                value={scheduled}
                onChange={(e) => setScheduled(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="t-dl">Deadline</Label>
              <Input
                id="t-dl"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate?: Date | null;
  onCreated?: () => void;
}

export function TaskCreateModal({ open, onOpenChange, defaultDate, onCreated }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low"|"medium"|"high"|"urgent">("medium");
  const [scheduled, setScheduled] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(""); setDescription(""); setPriority("medium");
      setScheduled(defaultDate ? format(defaultDate, "yyyy-MM-dd'T'HH:mm") : "");
      setDeadline("");
    }
  }, [open, defaultDate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("tasks").insert({
      title, description: description || null, priority,
      scheduled_for: scheduled ? new Date(scheduled).toISOString() : null,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      creator_id: user.id, assignee_id: user.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Task created");
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="t-desc">Description</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="t-sch">Scheduled for</Label>
              <Input id="t-sch" type="datetime-local" value={scheduled}
                onChange={(e) => setScheduled(e.target.value)} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="t-dl">Deadline</Label>
            <Input id="t-dl" type="datetime-local" value={deadline}
              onChange={(e) => setDeadline(e.target.value)} className="mt-1.5" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy}
              className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

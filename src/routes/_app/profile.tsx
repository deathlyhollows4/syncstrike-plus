import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

interface MyTeam {
  id: string;
  name: string;
}

function ProfilePage() {
  const { user, role } = useAuth();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    blocked: 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setDisplayName(p?.display_name ?? "");
      setAvatarUrl(p?.avatar_url ?? "");

      const { data: tm } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id);
      const ids = (tm ?? []).map((x: any) => x.team_id);
      if (ids.length) {
        const { data: t } = await supabase.from("teams").select("id, name").in("id", ids);
        setTeams((t as MyTeam[]) ?? []);
      } else {
        setTeams([]);
      }

      // Fetch personal task statistics
      const { data: tasks } = await supabase
        .from("tasks")
        .select("status")
        .or(`creator_id.eq.${user.id},assignee_id.eq.${user.id}`);
      if (tasks) {
        const stats = tasks.reduce(
          (acc, task) => {
            acc.total++;
            if (task.status === "completed") acc.completed++;
            else if (task.status === "in_progress") acc.inProgress++;
            else if (task.status === "blocked") acc.blocked++;
            return acc;
          },
          { total: 0, completed: 0, inProgress: 0, blocked: 0 }
        );
        setTaskStats(stats);
      }
    })();
  }, [user]);

  const updatePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("At least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPwd("");
    toast.success("Password updated");
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Account</p>
        <h1 className="font-display text-3xl font-bold mt-1">Profile</h1>
      </div>

      <Card className="p-6 surface border-border/60 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
          <p className="font-medium">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Role</p>
          <p className="font-medium capitalize">{role}</p>
        </div>
      </Card>

      <Card className="p-6 surface border-border/60">
        <h2 className="font-display text-lg font-semibold">Personal info</h2>
        <form onSubmit={saveProfile} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="dn">Display name</Label>
            <Input
              id="dn"
              value={displayName}
              maxLength={80}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="av">Avatar URL</Label>
            <Input
              id="av"
              value={avatarUrl}
              placeholder="https://…"
              maxLength={500}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button
            type="submit"
            disabled={savingProfile}
            className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold"
          >
            {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </form>
      </Card>

      <Card className="p-6 surface border-border/60">
        <h2 className="font-display text-lg font-semibold">Task Analytics</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gold-shine">{taskStats.total}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Tasks</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-success">{taskStats.completed}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gold-shine">{taskStats.inProgress}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">In Progress</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-destructive">{taskStats.blocked}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Blocked</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 surface border-border/60">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">My teams</h2>
          <Link to="/teams" className="text-xs text-gold-shine hover:underline">
            Manage →
          </Link>
        </div>
        {teams.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">You're not in any team yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {teams.map((t) => (
              <Badge
                key={t.id}
                variant="outline"
                className="gap-1 border-gold-shine/30 text-foreground"
              >
                <Users className="h-3 w-3 text-gold-shine" /> {t.name}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6 surface border-border/60">
        <h2 className="font-display text-lg font-semibold">Change password</h2>
        <form onSubmit={updatePwd} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="np">New password</Label>
            <Input
              id="np"
              type="password"
              minLength={8}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold"
          >
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
}

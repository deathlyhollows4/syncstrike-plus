import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Users,
  Trash2,
  MessageSquare,
  Search,
  Crown,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/teams")({ component: TeamsPage });

interface Team {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}
interface Member {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
}
interface Profile {
  id: string;
  email: string;
  display_name: string | null;
}

function TeamsPage() {
  const { user, isAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const load = async () => {
    const { data: t } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false });
    setTeams((t as Team[]) ?? []);
    const ids = (t ?? []).map((x: any) => x.id);
    if (ids.length) {
      const { data: m } = await supabase.from("team_members").select("*").in("team_id", ids);
      setMembers((m as Member[]) ?? []);
      const userIds = Array.from(
        new Set([
          ...(m ?? []).map((x: any) => x.user_id),
          ...(t ?? []).map((x: any) => x.owner_id),
        ]),
      );
      if (userIds.length) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds);
        const map: Record<string, Profile> = {};
        (p ?? []).forEach((x: any) => {
          map[x.id] = x;
        });
        setProfiles(map);
      }
    } else {
      setMembers([]);
    }
  };

  useEffect(() => {
    load();
  }, [user]);
  useEffect(() => {
    const ch = supabase
      .channel("teams-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    if (!selectedId && teams && teams.length) setSelectedId(teams[0].id);
  }, [teams, selectedId]);

  const selected = useMemo(
    () => teams?.find((t) => t.id === selectedId) ?? null,
    [teams, selectedId],
  );
  const teamMembers = useMemo(
    () => members.filter((m) => m.team_id === selectedId),
    [members, selectedId],
  );
  const memberCount = (teamId: string) => members.filter((m) => m.team_id === teamId).length;

  const startEdit = () => {
    if (!selected) return;
    setEditName(selected.name);
    setEditDesc(selected.description ?? "");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("teams")
      .update({ name: editName.trim(), description: editDesc.trim() || null })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Team updated");
    setEditing(false);
    load();
  };

  const removeMember = async (m: Member) => {
    if (!confirm("Remove this member from the team?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Member removed");
    load();
  };

  const deleteTeam = async () => {
    if (!selected) return;
    if (!confirm(`Delete team "${selected.name}"? This removes all members and chat history.`))
      return;
    const { error } = await supabase.from("teams").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Team deleted");
    setSelectedId(null);
    load();
  };

  if (teams === null) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Collaboration</p>
          <h1 className="font-display text-3xl font-bold mt-1">Teams</h1>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gold-shine text-[oklch(0.16_0.02_75)] hover:opacity-90 font-semibold"
          >
            <Plus className="mr-1 h-4 w-4" /> New team
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <Card className="surface border-border/60 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-gold-shine" />
          <p className="mt-4 font-display text-lg font-semibold">No teams yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Create your first team to start collaborating."
              : "Ask an admin to add you to a team."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Team list */}
          <Card className="surface border-border/60 overflow-hidden">
            <ul className="divide-y divide-border/40">
              {teams.map((t) => {
                const active = t.id === selectedId;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setSelectedId(t.id);
                        setEditing(false);
                      }}
                      className={`w-full text-left px-4 py-3 transition flex items-center gap-3 ${
                        active
                          ? "bg-gold-shine/10 border-l-2 border-gold-shine"
                          : "hover:bg-accent/30"
                      }`}
                    >
                      <Users className="h-4 w-4 shrink-0 text-gold-shine" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {memberCount(t.id)} {memberCount(t.id) === 1 ? "member" : "members"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Detail */}
          {selected ? (
            <Card className="surface border-border/60 p-6 space-y-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="font-display text-xl font-bold"
                      />
                      <Textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        placeholder="Description (optional)"
                      />
                    </div>
                  ) : (
                    <>
                      <h2 className="font-display text-2xl font-bold">{selected.name}</h2>
                      {selected.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                      )}
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3 w-3 text-gold-shine" />
                      Owner:{" "}
                      {profiles[selected.owner_id]?.display_name ??
                        profiles[selected.owner_id]?.email ??
                        "—"}
                    </span>
                    <span>Created {format(new Date(selected.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && !editing && (
                    <>
                      <Button size="sm" variant="ghost" onClick={startEdit}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={deleteTeam}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {editing && (
                    <>
                      <Button size="sm" variant="ghost" onClick={saveEdit}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Link to="/chat" search={{ team: selected.id } as any}>
                    <Button size="sm" variant="outline" className="ml-2">
                      <MessageSquare className="h-4 w-4 mr-1" /> Chat
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Members ({teamMembers.length})
                  </h3>
                  {isAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" /> Add member
                    </Button>
                  )}
                </div>
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {teamMembers.map((m) => {
                      const p = profiles[m.user_id];
                      const isOwner = m.user_id === selected.owner_id;
                      return (
                        <li
                          key={m.id}
                          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2"
                        >
                          <div className="h-8 w-8 rounded-full bg-gold-shine/20 flex items-center justify-center text-xs font-bold text-gold-shine">
                            {(p?.display_name ?? p?.email ?? "?")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {p?.display_name ?? p?.email?.split("@")[0] ?? "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{p?.email}</p>
                          </div>
                          {isOwner && (
                            <Badge className="bg-gold-shine/20 text-gold-shine border-gold-shine/40">
                              Owner
                            </Badge>
                          )}
                          {isAdmin && !isOwner && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => removeMember(m)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          ) : (
            <Card className="surface border-border/60 p-12 text-center text-sm text-muted-foreground">
              Select a team to see details.
            </Card>
          )}
        </div>
      )}

      <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      {selected && (
        <AddMemberDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          team={selected}
          existingMemberIds={teamMembers.map((m) => m.user_id)}
          onAdded={load}
        />
      )}
    </div>
  );
}

/* -------- Create team dialog -------- */

function CreateTeamDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || name.trim().length < 2) return toast.error("Name must be at least 2 characters");
    setBusy(true);
    const { data: team, error } = await supabase
      .from("teams")
      .insert({ name: name.trim(), description: description.trim() || null, owner_id: user.id })
      .select()
      .single();
    if (error || !team) {
      setBusy(false);
      return toast.error(error?.message ?? "Failed to create team");
    }
    // Auto-add owner as member
    await supabase.from("team_members").insert({ team_id: team.id, user_id: user.id });
    setBusy(false);
    toast.success("Team created");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">New team</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="tn">Name</Label>
            <Input
              id="tn"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="td">Description</Label>
            <Textarea
              id="td"
              maxLength={300}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
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

/* -------- Add member dialog -------- */

function AddMemberDialog({
  open,
  onOpenChange,
  team,
  existingMemberIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  team: Team;
  existingMemberIds: string[];
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      if (q.trim().length < 1) {
        setResults([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(10);
      setResults((data as Profile[]) ?? []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const add = async (p: Profile) => {
    setBusy(true);
    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: p.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${p.display_name ?? p.email} added`);
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Add member to {team.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by email or name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
            {results.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                {q ? "No matches." : "Type to search profiles."}
              </p>
            ) : (
              results.map((p) => {
                const already = existingMemberIds.includes(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.display_name ?? p.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={already || busy}
                      onClick={() => add(p)}
                      variant={already ? "ghost" : "default"}
                    >
                      {already ? "Added" : "Add"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
